import Debug from 'debug';
const debug = Debug('issuer:as:verifier');
import { EmbeddedASSettings } from '#root/as/config';

export interface VerifierOffer {
    state: string;
    requestUri: string;
    checkUri: string;
}

export interface VerifierCheckResult {
    status?: string;
    result?: {
        credentials?: { [id: string]: any[] };
        messages?: { code: string, [x: string]: any }[];
        presentationDuringIssuanceSession?: string;
        responseCode?: string;
    };
}

type FetchFn = typeof fetch;

function headers(settings: EmbeddedASSettings): { [x: string]: string } {
    if (!settings.verifierUrl || !settings.verifierToken) {
        // checked at create-offer, but never call the verifier without a token
        throw new Error('The verifier is not configured for presentation during issuance');
    }
    return {
        'Authorization': 'Bearer ' + settings.verifierToken,
        'Content-Type': 'application/json'
    };
}

export async function createVerifierOffer(settings: EmbeddedASSettings, dcql: object, redirectUri?: string, fetchFn: FetchFn = fetch): Promise<VerifierOffer> {
    const response = await fetchFn(settings.verifierUrl + '/api/create-dcql-offer', {
        method: 'POST',
        headers: headers(settings),
        body: JSON.stringify({
            dcql,
            presentation_during_issuance: true,
            ...(redirectUri && { redirectUri })
        })
    });
    if (!response.ok) {
        debug('verifier refused the request', response.status);
        throw new Error('The verifier could not create the request (' + response.status + ')');
    }
    const body: any = await response.json();
    if (!body || typeof body.state != 'string' || typeof body.requestUri != 'string') {
        throw new Error('Unexpected response of the verifier');
    }
    return { state: body.state, requestUri: body.requestUri, checkUri: body.checkUri };
}

export async function checkVerifierOffer(settings: EmbeddedASSettings, state: string, fetchFn: FetchFn = fetch): Promise<VerifierCheckResult> {
    const response = await fetchFn(settings.verifierUrl + '/api/check-offer/' + encodeURIComponent(state), {
        method: 'GET',
        headers: headers(settings)
    });
    if (!response.ok) {
        debug('verifier check failed', response.status);
        throw new Error('The verifier could not be checked (' + response.status + ')');
    }
    return await response.json() as VerifierCheckResult;
}
