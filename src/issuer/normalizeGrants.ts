import { v4 } from 'uuid'
import { Grant } from '@sphereon/oid4vci-common'
import { assertValidPinNumber } from '@sphereon/oid4vci-issuer'

 export function normalizeGrants(grants: Grant, pinLength: number) {
    let preAuthorizedCode: string | undefined = undefined
    let issuerState: string | undefined = undefined
    let userPin: string | undefined
  
    if (grants?.authorization_code) {
        issuerState = grants?.authorization_code.issuer_state
        if (!issuerState) {
            issuerState = v4()
            grants.authorization_code.issuer_state = issuerState
        }
    }
  
    if (grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']) {
        preAuthorizedCode = grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code']
        let userPinRequiredObject = grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.tx_code;
        if (userPinRequiredObject) {
            const length = pinLength ?? 4;
            userPin = ('' + Math.round((Math.pow(10, length) - 1) * Math.random())).padStart(length, '0')
            assertValidPinNumber(userPin)
            grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].tx_code = {
                input_mode: 'numeric',
                length: length,
                description: 'PIN'
            }
        }
        if (!preAuthorizedCode) {
            preAuthorizedCode = v4()
            grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code'] = preAuthorizedCode
        }
        // replace any unwanted characters to keep a safe code
        preAuthorizedCode.replace(/[\W_]+/g,"").replace(/\s+/g, "");

    }

    return { grants, issuerState, preAuthorizedCode, userPin };
}