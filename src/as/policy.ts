import { ACCEPTED_MESSAGE_CODES } from '#root/as/constants';
import { VerifierCheckResult } from '#root/as/verifierClient';

// see doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.3

export interface PresentationOutcome {
    accepted: boolean;
    reason?: string;
    presentationData?: { [id: string]: object | object[] };
    presentationMeta?: { [id: string]: { issuer?: string, holder?: string } };
}

function rejected(reason: string): PresentationOutcome {
    return { accepted: false, reason };
}

function hasPath(claims: any, path: any[]): boolean {
    let current = claims;
    for (const element of path) {
        if (typeof element != 'string') {
            // wildcards and array indexes are not evaluated here
            return true;
        }
        if (current === null || typeof current != 'object' || !(element in current)) {
            return false;
        }
        current = current[element];
    }
    return true;
}

/**
 * Decides on the result of the verifier for the DCQL query that we sent. credential_sets and multiple are
 * interpreted by the wallet, we do not evaluate them.
 */
export function evaluatePresentation(dcql: any, check: VerifierCheckResult): PresentationOutcome {
    const result = check.result;
    if (check.status != 'RESPONSE_RECEIVED' || !result) {
        return rejected('no response');
    }

    for (const message of result.messages ?? []) {
        if (!ACCEPTED_MESSAGE_CODES.includes(message.code)) {
            return rejected('verification failed: ' + message.code);
        }
    }

    const queries: any[] = Array.isArray(dcql?.credentials) ? dcql.credentials : [];
    const queryIds = queries.map((q) => q.id);
    const received = result.credentials ?? {};
    // only what was asked for is kept
    const ids = Object.keys(received).filter((id) => queryIds.includes(id) && Array.isArray(received[id]) && received[id].length > 0);
    if (ids.length == 0) {
        return rejected('no credentials presented');
    }

    const hasCredentialSets = Array.isArray(dcql?.credential_sets) && dcql.credential_sets.length > 0;
    if (!hasCredentialSets) {
        for (const id of queryIds) {
            if (!ids.includes(id)) {
                return rejected('credential ' + id + ' not presented');
            }
        }
    }

    const presentationData: { [id: string]: object | object[] } = {};
    const presentationMeta: { [id: string]: { issuer?: string, holder?: string } } = {};
    for (const id of ids) {
        const query = queries.find((q) => q.id == id);
        const presented: any[] = received[id];
        if (presented.length > 1 && query.multiple !== true) {
            return rejected('credential ' + id + ' presented more than once');
        }
        const claimQueries: any[] = Array.isArray(query.claims) && !query.claim_sets ? query.claims : [];
        for (const credential of presented) {
            for (const claim of claimQueries) {
                if (Array.isArray(claim?.path) && !hasPath(credential.claims, claim.path)) {
                    return rejected('credential ' + id + ' misses a requested claim');
                }
            }
        }
        presentationData[id] = presented.length == 1 ? (presented[0].claims ?? {}) : presented.map((p) => p.claims ?? {});
        presentationMeta[id] = { issuer: presented[0].issuer, holder: presented[0].holder };
    }
    return { accepted: true, presentationData, presentationMeta };
}
