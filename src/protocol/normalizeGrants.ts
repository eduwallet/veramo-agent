import { createUniqueId } from '#root/utils/createUniqueId';
import { AUTHORIZATION_CODE_GRANT, Grants, PRE_AUTHORIZED_CODE, PRE_AUTHORIZED_CODE_GRANT } from '../types/specification/credential_offer.js';
import { generatePin } from './generatePin.js';
import { APIGrants } from 'types/api/credentialOffer.js';

 export function normalizeGrants(apiGrants: APIGrants) {
    let preAuthorizedCode: string | undefined = undefined
    let issuerState: string | undefined = undefined
    let userPin: string | undefined
  
    if (apiGrants[AUTHORIZATION_CODE_GRANT]) {
        issuerState = apiGrants[AUTHORIZATION_CODE_GRANT].issuer_state;
        if (!issuerState || issuerState == '' || issuerState == 'generate') {
            issuerState = createUniqueId();
            apiGrants[AUTHORIZATION_CODE_GRANT].issuer_state = issuerState
        }
    }
  
    if (apiGrants[PRE_AUTHORIZED_CODE_GRANT]) {
        if (typeof(apiGrants[PRE_AUTHORIZED_CODE_GRANT]) !== 'object' || Array.isArray(apiGrants[PRE_AUTHORIZED_CODE_GRANT])) {
            apiGrants[PRE_AUTHORIZED_CODE_GRANT] = {};
        }
        preAuthorizedCode = apiGrants[PRE_AUTHORIZED_CODE_GRANT][PRE_AUTHORIZED_CODE]
        const txCode = apiGrants[PRE_AUTHORIZED_CODE_GRANT].tx_code;
        if (txCode !== false && txCode) {
            const length = txCode === true ? 4 : (txCode.length || 4);
            const mode = txCode === true ? 'numeric' : (txCode?.input_mode || 'numeric');
            const description = txCode === true ? 'PIN' : (txCode?.description || 'PIN');
            if (txCode === true || !txCode.code) {
                userPin = generatePin(mode, length);
            }
            else {
                userPin = txCode.code;
            }

            // overwrite the tx_code to make sure the object contains only relevant fields
            apiGrants[PRE_AUTHORIZED_CODE_GRANT].tx_code = {
                input_mode: mode,
                length: length,
                description: description
            }
        }
        else if (Object.keys(apiGrants[PRE_AUTHORIZED_CODE_GRANT]).includes('tx_code')) {
            delete apiGrants[PRE_AUTHORIZED_CODE_GRANT].tx_code;
        }
        if (!preAuthorizedCode || preAuthorizedCode == 'generate') {
            preAuthorizedCode = createUniqueId();
            apiGrants[PRE_AUTHORIZED_CODE_GRANT][PRE_AUTHORIZED_CODE] = preAuthorizedCode
        }
    }
    const grants = apiGrants as Grants;
    return { grants, issuerState, preAuthorizedCode, userPin };
}