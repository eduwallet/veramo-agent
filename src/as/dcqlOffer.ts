import { Issuer } from '#root/issuer/Issuer';
import { RESERVED_TOKEN_CLAIMS } from '#root/as/constants';
import { CreateCredentialOfferRequestV2 } from '#root/types/api/credentialOffer';
import { AUTHORIZATION_CODE_GRANT } from '#root/types/specification/credential_offer';

// Validation of the dcql query of create-offer, see doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.5
// The front-end is responsible for the query itself (it has checked that the verifier handles it). We only check
// what we need ourselves.

const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * The presence of a dcql query starts the verification during issuance flow. It implies the authorization_code grant
 */
export function applyPresentationDefaults(request: CreateCredentialOfferRequestV2) {
    if (request && typeof request == 'object' && request.dcql !== undefined && request.grant === undefined) {
        request.grant = AUTHORIZATION_CODE_GRANT;
    }
}

function collectOrigins(node: any, found: string[][]) {
    if (Array.isArray(node)) {
        node.forEach((n) => collectOrigins(n, found));
    }
    else if (node && typeof node == 'object') {
        for (const [key, value] of Object.entries(node)) {
            if (key == 'origin' && Array.isArray(value)) {
                for (const origin of value) {
                    if (Array.isArray(origin) && origin[0] === '#accessData' && typeof origin[1] == 'string') {
                        found.push(origin);
                    }
                }
            }
            else {
                collectOrigins(value, found);
            }
        }
    }
}

/**
 * Returns a description of the first problem, or null if the request is acceptable
 */
export function validatePresentationRequest(issuer: Issuer, request: CreateCredentialOfferRequestV2): string | null {
    if (request.dcql === undefined) {
        return null;
    }
    if (request.grant !== AUTHORIZATION_CODE_GRANT) {
        return 'A dcql query requires the authorization_code grant';
    }

    // the preconditions of the embedded authorization server, so that a failure is visible here and not to the wallet
    const settings = issuer.embeddedASSettings();
    if (!settings) {
        return 'A dcql query requires the embedded authorization server (embeddedAuthorizationServer.enabled)';
    }
    if (!settings.verifierUrl) {
        return 'A dcql query requires embeddedAuthorizationServer.verifier.url';
    }
    if (!settings.verifierToken) {
        return 'A dcql query requires embeddedAuthorizationServer.verifier.verifierToken';
    }
    if (settings.mode != 'in-app' && settings.clients.length == 0) {
        return 'A dcql query requires embeddedAuthorizationServer.clients for mode ' + settings.mode;
    }

    const dcql: any = request.dcql;
    if (!dcql || typeof dcql != 'object' || Array.isArray(dcql) || !Array.isArray(dcql.credentials) || dcql.credentials.length == 0) {
        return 'The dcql query requires a non-empty credentials array';
    }
    const ids = new Set<string>();
    for (const query of dcql.credentials) {
        const id = query?.id;
        if (typeof id != 'string' || !ID_PATTERN.test(id)) {
            return 'Every credential query in the dcql query requires an id of letters, digits, underscore or hyphen';
        }
        if (ids.has(id)) {
            return 'Duplicate credential query id ' + id;
        }
        if (RESERVED_TOKEN_CLAIMS.includes(id)) {
            return 'The credential query id ' + id + ' is the name of an access token claim';
        }
        ids.add(id);
    }

    // claims that take their value from #accessData must refer to a credential of the query (or a token claim)
    for (const credential of request.credentials ?? []) {
        const config = issuer.getCredentialConfiguration(credential?.credential_configuration_id);
        const origins: string[][] = [];
        collectOrigins(config, origins);
        for (const origin of origins) {
            if (!ids.has(origin[1]) && !RESERVED_TOKEN_CLAIMS.includes(origin[1])) {
                return 'Credential ' + credential.credential_configuration_id + ' refers to #accessData ' + origin[1] + ', which is not in the dcql query';
            }
        }
    }
    return null;
}
