import { Issuer } from "issuer/Issuer";
import { CredentialRequest } from "types/specification/credential_request";
import { CredentialResponse } from "types/specification/credential_response";
import { CredentialConfiguration } from "types/specification/metadata";
import { SessionState } from "utils/SessionStateManager";

export async function issueCredential(issuer:Issuer, request:CredentialRequest, session:SessionState, credentialType:CredentialConfiguration): CredentialResponse
{

    var stateId = '';
    const response = await this.vcIssuer.issueCredential({
        credentialRequest,
        tokenExpiresIn: 300,
        cNonceExpiresIn: 5000,
        jwtVerifyCallback: async (args: { jwt: string; kid?: string }) => {
            if (this.vcIssuer.jwtVerifyCallback) {
                // jump through some loops to get data about the holder into our session state
                const result = await this.vcIssuer.jwtVerifyCallback(args);
                const holder = result.did;
                const nonce = result.jwt.payload.nonce;
                const cNonceState = await this.vcIssuer.cNonces.getAsserted(nonce || '')
                stateId = cNonceState.preAuthorizedCode || cNonceState.issuerState || '';
                var sessionState = await this.getSessionById(stateId);
                sessionState.holder = holder;
                await this.sessionData.set(stateId, sessionState);
                return result;
            }
            throw new Error('no jwtVerifyCallback defined');
        }
    });
    await issuer.storeCredential(response.state);
    return response.response;
}
