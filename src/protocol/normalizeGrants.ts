import { v4 } from 'uuid'
import { AUTHORIZATION_CODE_GRANT, Grants, PRE_AUTHORIZED_CODE, PRE_AUTHORIZED_CODE_GRANT } from '../types/specification/credential_offer';
import { generatePin } from './generatePin';
import { APIGrants } from 'types/api/credentialOffer';

 export function normalizeGrants(apiGrants: APIGrants) {
    let preAuthorizedCode: string | undefined = undefined
    let issuerState: string | undefined = undefined
    let userPin: string | undefined
  
    if (apiGrants[AUTHORIZATION_CODE_GRANT]) {
        issuerState = apiGrants[AUTHORIZATION_CODE_GRANT].issuer_state;
        if (!issuerState || issuerState == '' || issuerState == 'generate') {
            issuerState = v4();
            apiGrants[AUTHORIZATION_CODE_GRANT].issuer_state = issuerState
        }
    }
  
    if (apiGrants[PRE_AUTHORIZED_CODE_GRANT]) {
        preAuthorizedCode = apiGrants[PRE_AUTHORIZED_CODE_GRANT][PRE_AUTHORIZED_CODE]
        let txCode = apiGrants[PRE_AUTHORIZED_CODE_GRANT].tx_code;
        if (txCode !== false && txCode) {
            const length = txCode === true ? 4 : (txCode.length || 4);
            const mode = txCode === true ? 'numeric' : (txCode?.input_mode || 'numeric');
            const description = txCode === true ? 'PIN' : (txCode?.description || 'PIN');
            userPin = generatePin(mode, length);
            apiGrants[PRE_AUTHORIZED_CODE_GRANT].tx_code = {
                input_mode: mode,
                length: length,
                description: description
            }
        }
        if (!preAuthorizedCode || preAuthorizedCode == 'generate') {
            preAuthorizedCode = v4()
            apiGrants[PRE_AUTHORIZED_CODE_GRANT][PRE_AUTHORIZED_CODE] = preAuthorizedCode
        }
        // replace any unwanted characters (non-alphanumeric, underscores and whitespace) to keep a safe code
        preAuthorizedCode = preAuthorizedCode.replace(/[\W_\s]+/g,"");
    }
    const grants = apiGrants as Grants;
    return { grants, issuerState, preAuthorizedCode, userPin };
}