import Debug from 'debug';
const debug = Debug('issuer:as:presentation');
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { CredentialOfferStatus } from '#root/types/api';
import { AUTHORIZATION_CODE_GRANT } from '#root/types/specification/credential_offer';
import { EmbeddedASSettings, canStartPresentation } from '#root/as/config';
import { POLL_INTERVAL } from '#root/as/constants';
import { VerifierOffer, checkVerifierOffer, createVerifierOffer } from '#root/as/verifierClient';
import { evaluatePresentation } from '#root/as/policy';
import { createCompositeValue, safeEqual, sessionHasExpired } from '#root/as/util';

// The steps that the in-app flow (authorization challenge endpoint) and the redirect flow (authorize and continue
// endpoints) have in common. See doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.1

const STATES_BEFORE_CODE = [
    CredentialOfferStatus.OFFER_CREATED,
    CredentialOfferStatus.OFFER_URI_RETRIEVED,
    CredentialOfferStatus.PRESENTATION_REQUESTED,
    CredentialOfferStatus.AUTHORIZATION_DENIED
];

/**
 * The session an issuer_state refers to, if a presentation can be started for it. Null for every problem, because
 * the wallet is not told which condition failed.
 */
export async function findSessionForPresentation(issuer: Issuer, settings: EmbeddedASSettings, issuerState: unknown): Promise<Session | null> {
    const state = typeof issuerState == 'string' ? issuerState : '';
    const session = state ? await issuer.getSessionByState(state) : null;
    if (!session || !session.data?.authorization?.presentation?.dcql || sessionHasExpired(session)
        || !session.data.credentialOffer?.grants?.[AUTHORIZATION_CODE_GRANT]
        || !STATES_BEFORE_CODE.includes(session.data.status)
        || !canStartPresentation(settings)) {
        return null;
    }
    return session;
}

export function parseAuthorizationDetails(value: any): any[] | null {
    let details = value;
    if (typeof details == 'string') {
        try {
            details = JSON.parse(details);
        }
        catch {
            return null;
        }
    }
    if (!Array.isArray(details) || details.length == 0) {
        return null;
    }
    const valid = details.every((d) => d && d.type == 'openid_credential' && typeof d.credential_configuration_id == 'string');
    return valid ? details : null;
}

export function validAuthorizationDetails(session: Session, value: any): boolean {
    const details = parseAuthorizationDetails(value);
    const offered: string[] = session.data.credentialOffer?.credential_configuration_ids ?? [];
    return !!details && details.every((d) => offered.includes(d.credential_configuration_id));
}

export interface StartParameters {
    codeChallenge: string;
    clientId?: string;
    dpopJkt?: string;
    // redirect flow only
    redirectUri?: string;
    state?: string;
    verifierRedirectUri?: string;
}

export interface StartedPresentation {
    offer: VerifierOffer;
    authSession: string;
    // redirect flow: the secret that identifies the browser, to be put in a cookie
    browserSecret: string;
    expiresAt: number;
}

/**
 * Creates the request at the verifier and stores the new auth_session. On failure the session is denied and the
 * error is thrown.
 */
export async function startPresentation(issuer: Issuer, settings: EmbeddedASSettings, session: Session, parameters: StartParameters): Promise<StartedPresentation> {
    const presentation = session.data.authorization.presentation;
    let offer: VerifierOffer;
    try {
        offer = await createVerifierOffer(settings, presentation.dcql, parameters.verifierRedirectUri);
    }
    catch (e) {
        console.error('Could not create the verifier request', (e as Error).message);
        session.data.status = CredentialOfferStatus.AUTHORIZATION_DENIED;
        await issuer.storeSession(session);
        throw e;
    }

    const authSession = createCompositeValue(session.uuid);
    const browser = createCompositeValue(session.uuid);
    const expiresAt = Math.min(
        Date.now() + settings.authSessionTtl * 1000,
        session.expirationDate ? new Date(session.expirationDate).getTime() : Infinity
    );
    session.data.authorization = {
        ...session.data.authorization,
        clientId: parameters.clientId,
        redirectUri: parameters.redirectUri,
        state: parameters.state,
        pkce: { challenge: parameters.codeChallenge, method: 'S256' },
        code: undefined,
        presentation: {
            dcql: presentation.dcql,
            verifierState: offer.state,
            checkUri: offer.checkUri,
            authSessionHash: authSession.hash,
            browserHash: browser.hash,
            expiresAt,
            lastCheckedAt: 0,
            lastPolledAt: 0,
            ...(parameters.dpopJkt && { dpopJkt: parameters.dpopJkt })
        }
    };
    session.data.status = CredentialOfferStatus.PRESENTATION_REQUESTED;
    session.data.lastUpdatedAt = Date.now();
    await issuer.storeSession(session);
    await issuer.storeRequestResponseData(session.uuid, 'presentation-request', { requestUri: offer.requestUri });
    return { offer, authSession: authSession.value, browserSecret: browser.value, expiresAt };
}

export type Completion =
    | { kind: 'pending' }          // the wallet has not answered yet (or we asked the verifier a moment ago)
    | { kind: 'invalid' }          // invalid session
    | { kind: 'server_error' }
    | { kind: 'denied' }
    | { kind: 'code', code: string };

export interface CompletionProof {
    // in-app: the value that the verifier returned to the wallet; required
    sessionValue?: string;
    requireSessionValue: boolean;
    // redirect: the response_code of the redirect_uri, if the wallet was redirected to us
    responseCode?: string;
}

/**
 * Asks the verifier about the response, and if it was accepted, stores the verified claims and issues the
 * authorization code. The auth_session is single-use.
 */
export async function completePresentation(issuer: Issuer, settings: EmbeddedASSettings, session: Session, proof: CompletionProof): Promise<Completion> {
    const presentation = session.data.authorization.presentation;

    // at most one request to the verifier per interval
    if (Date.now() - (presentation.lastCheckedAt ?? 0) < POLL_INTERVAL * 1000) {
        return { kind: 'pending' };
    }
    presentation.lastCheckedAt = Date.now();
    await issuer.storeSession(session);

    let check;
    try {
        check = await checkVerifierOffer(settings, presentation.verifierState);
    }
    catch (e) {
        console.error('Could not check the verifier request', (e as Error).message);
        return { kind: 'server_error' };
    }

    // an expired or removed verifier session has no status
    if (!check.status) {
        return { kind: 'invalid' };
    }
    if (check.status != 'RESPONSE_RECEIVED') {
        return { kind: 'pending' };
    }

    if (proof.requireSessionValue || proof.sessionValue !== undefined) {
        if (!safeEqual(proof.sessionValue, check.result?.presentationDuringIssuanceSession)) {
            return { kind: 'invalid' };
        }
    }
    if (proof.responseCode !== undefined && !safeEqual(proof.responseCode, check.result?.responseCode)) {
        return { kind: 'invalid' };
    }

    // single use of the auth_session, atomic
    if (!await issuer.asClaims.claim('session:' + presentation.authSessionHash, new Date(presentation.expiresAt))) {
        return { kind: 'invalid' };
    }

    const outcome = evaluatePresentation(presentation.dcql, check);
    if (!outcome.accepted) {
        debug('presentation rejected', outcome.reason);
        session.data.status = CredentialOfferStatus.AUTHORIZATION_DENIED;
        await issuer.storeSession(session);
        return { kind: 'denied' };
    }

    const code = createCompositeValue(session.uuid);
    session.data.presentationData = outcome.presentationData;
    session.data.presentationMeta = outcome.presentationMeta;
    session.data.authorization.code = {
        hash: code.hash,
        expiresAt: Date.now() + settings.codeTtl * 1000
    };
    session.data.status = CredentialOfferStatus.PRESENTATION_VERIFIED;
    session.data.lastUpdatedAt = Date.now();
    await issuer.storeSession(session);
    await issuer.storeRequestResponseData(session.uuid, 'presentation-response', { accepted: true, credentials: Object.keys(outcome.presentationData ?? {}) });
    return { kind: 'code', code: code.value };
}
