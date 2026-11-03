import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { Credential } from '#root/credentials/Credential';
import { CredentialFactory } from '#root/credentials/CredentialFactory';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';
import { DeferredSessionData } from '#root/types/internal';
import { findUnusedClaims, getClaimDefinitions } from '#root/issuer/lib/claimDefinitions';

// maximum length of the reason for denying a credential
const MAX_REASON_LENGTH = 2000;

export interface ApiResult {
    status: number;
    body: any;
}

function failure(status:number, error:ErrorCodes, description:string, extra:object = {}): ApiResult
{
    return { status, body: { error, error_description: description, ...extra } };
}

/**
 * Find the deferred transaction of a session of this issuer. The session id is the uuid
 * that was returned when the offer was created.
 */
async function findTransaction(issuer:Issuer, id:string): Promise<{session:Session, deferred:DeferredSessionData}|null>
{
    if (!id || typeof(id) != 'string') {
        return null;
    }
    const session = await issuer.getSessionById(id);
    const deferred = session?.data?.deferred as DeferredSessionData|undefined;
    // getSessionById returns a new session if the id is unknown
    if (!session || !session.id || !deferred) {
        return null;
    }
    return { session, deferred };
}

function isOpen(deferred:DeferredSessionData): boolean
{
    return deferred.status == CredentialOfferStatus.CREDENTIAL_PENDING && +new Date() <= deferred.expiresAt;
}

/**
 * GET /api/v2/deferred
 * Lists the deferred transactions that have not expired. By default only the transactions waiting for
 * the back-office are listed.
 */
export async function listDeferredTransactions(issuer:Issuer, status?:string): Promise<ApiResult>
{
    const wanted = status && status.length ? status : CredentialOfferStatus.CREDENTIAL_PENDING;
    const now = +new Date();
    // the transaction is part of the session data, so it is filtered here and not in the database
    const sessions = await issuer.sessionData.getActive();
    const items = sessions
        .filter((s) => s.data?.deferred && s.data.deferred.status == wanted && s.data.deferred.expiresAt >= now)
        .map((s) => {
            const deferred = s.data.deferred as DeferredSessionData;
            return {
                id: s.uuid,
                credential_configuration_id: deferred.credentialId,
                status: deferred.status,
                createdAt: deferred.createdAt,
                expiresAt: deferred.expiresAt,
            };
        });
    return { status: 200, body: items };
}

/**
 * GET /api/v2/deferred/:id
 */
export async function getDeferredTransaction(issuer:Issuer, id:string): Promise<ApiResult>
{
    const transaction = await findTransaction(issuer, id);
    if (!transaction) {
        return failure(404, ErrorCodes.INVALID_REQUEST, `Deferred transaction ${id} not found`);
    }
    const { deferred } = transaction;
    const configuration = issuer.getCredentialConfiguration(deferred.credentialId);

    return {
        status: 200,
        body: {
            id,
            status: deferred.status,
            createdAt: deferred.createdAt,
            expiresAt: deferred.expiresAt,
            credential_configuration_id: deferred.credentialId,
            format: configuration?.format ?? null,
            proofs: deferred.holders.length,
            ttl: deferred.ttl,
            interval: deferred.interval,
            // the data known from the offer, and the claims supplied by the back-office so far
            data: deferred.credentialDataSet?.data ?? {},
            claims_supplied: deferred.claims ?? {},
            claims: getClaimDefinitions(configuration).map((c) => ({
                path: c.path,
                type: c.type,
                mandatory: c.mandatory,
                origin: c.origin,
                // the paths that the back-office can use in the claims of the POST
                supply: c.supply,
            })),
            ...(deferred.reason && { reason: deferred.reason }),
        }
    };
}

/**
 * POST /api/v2/deferred/:id
 * Body: { claims?, status?, reason? }
 *
 * Without a status, or with status CREDENTIAL_READY, the claims are validated. If the credential data is
 * valid, the transaction is released and the wallet can collect the credential.
 * With status CREDENTIAL_DENIED the transaction is rejected. The reason is logged and kept with the session.
 */
export async function updateDeferredTransaction(issuer:Issuer, id:string, body:any): Promise<ApiResult>
{
    const transaction = await findTransaction(issuer, id);
    if (!transaction) {
        return failure(404, ErrorCodes.INVALID_REQUEST, `Deferred transaction ${id} not found`);
    }
    const { session, deferred } = transaction;

    if (body === null || typeof(body) != 'object' || Array.isArray(body)) {
        return failure(400, ErrorCodes.INVALID_REQUEST, 'Invalid request body');
    }
    const { claims, status, reason } = body;
    if (typeof(claims) != 'undefined' && (claims === null || typeof(claims) != 'object' || Array.isArray(claims))) {
        return failure(400, ErrorCodes.INVALID_REQUEST, 'claims must be an object');
    }
    if (typeof(reason) != 'undefined' && (typeof(reason) != 'string' || reason.length > MAX_REASON_LENGTH)) {
        return failure(400, ErrorCodes.INVALID_REQUEST, `reason must be a string of at most ${MAX_REASON_LENGTH} characters`);
    }
    if (typeof(status) != 'undefined' && status !== CredentialOfferStatus.CREDENTIAL_READY && status !== CredentialOfferStatus.CREDENTIAL_DENIED) {
        return failure(400, ErrorCodes.INVALID_REQUEST, `status must be ${CredentialOfferStatus.CREDENTIAL_READY} or ${CredentialOfferStatus.CREDENTIAL_DENIED}`);
    }
    const denied = status === CredentialOfferStatus.CREDENTIAL_DENIED;
    if (denied && typeof(claims) != 'undefined') {
        return failure(400, ErrorCodes.INVALID_REQUEST, 'claims cannot be combined with status ' + CredentialOfferStatus.CREDENTIAL_DENIED);
    }

    if (!isOpen(deferred)) {
        return failure(409, ErrorCodes.INVALID_REQUEST, `The transaction is ${deferred.status}, or it has expired`);
    }

    if (denied) {
        return await denyTransaction(issuer, session, deferred, reason);
    }
    return await releaseTransaction(issuer, session, deferred, claims);
}

async function denyTransaction(issuer:Issuer, session:Session, deferred:DeferredSessionData, reason?:string): Promise<ApiResult>
{
    deferred.status = CredentialOfferStatus.CREDENTIAL_DENIED;
    if (reason) {
        deferred.reason = reason;
    }
    session.data.deferred = deferred;
    session.data.status = CredentialOfferStatus.CREDENTIAL_DENIED;
    session.data.lastUpdatedAt = +new Date();
    // newlines are removed from the reason to keep the log lines intact
    console.info(`[deferred] issuer=${issuer.name} session=${session.uuid} transaction=${deferred.transactionId} credential=${deferred.credentialId} denied, reason: ${reason ? reason.replace(/[\r\n]+/g, ' ') : '(no reason given)'}`);
    await issuer.storeRequestResponseData(session.uuid, 'deferred-denied', { reason: reason ?? null, at: +new Date() });
    await issuer.storeSession(session);
    return { status: 200, body: { id: session.uuid, status: deferred.status } };
}

async function releaseTransaction(issuer:Issuer, session:Session, deferred:DeferredSessionData, claims?:object): Promise<ApiResult>
{
    const configuration = issuer.getCredentialConfiguration(deferred.credentialId);
    if (!configuration) {
        return failure(409, ErrorCodes.INVALID_REQUEST, 'The credential configuration of this transaction no longer exists');
    }

    if (typeof(claims) != 'undefined') {
        const { unknown, forbidden } = findUnusedClaims(getClaimDefinitions(configuration), claims);
        if (forbidden.length) {
            return failure(400, ErrorCodes.INVALID_REQUEST, 'Invalid claim names', { claims: forbidden });
        }
        if (unknown.length) {
            return failure(400, ErrorCodes.INVALID_REQUEST, 'Claims that are not used by this credential', { claims: unknown });
        }
    }
    const newClaims = claims ?? deferred.claims ?? {};

    // build the credential data as it will be built when the wallet collects the credential
    const credential = new Credential();
    credential.issuer = issuer;
    credential.id = deferred.credentialId;
    credential.setConfiguration(configuration);
    const offerData = deferred.credentialDataSet?.data ?? {};
    credential.offerData = structuredClone(offerData);
    credential.data = structuredClone(offerData);
    credential.deferredData = structuredClone(newClaims);

    const errors = CredentialFactory.validateClaims(credential, session.data.accessData);
    if (errors.length) {
        debug("deferred claims are not valid", errors);
        // the transaction is not released and the claims are not stored
        return failure(400, ErrorCodes.INVALID_REQUEST, 'The claims are not valid for this credential', { errors });
    }

    deferred.claims = newClaims;
    deferred.status = CredentialOfferStatus.CREDENTIAL_READY;
    session.data.deferred = deferred;
    session.data.status = CredentialOfferStatus.CREDENTIAL_READY;
    session.data.lastUpdatedAt = +new Date();
    await issuer.storeSession(session);
    return { status: 200, body: { id: session.uuid, status: deferred.status } };
}
