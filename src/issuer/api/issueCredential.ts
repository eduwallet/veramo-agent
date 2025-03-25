import { CredentialPayload, W3CVerifiableCredential } from "@veramo/core";
import { getAgent } from "agent";
import { credentialResolver } from "credentials/credentialResolver";
import { Issuer } from "issuer/Issuer";
import { CredentialOfferStatus } from "types/api";
import { CredentialProofData } from "types/internal";
import { CredentialResponse } from "types/specification/credential_response";
import { v4 } from 'uuid';

export async function issueCredential(issuer:Issuer, proofData:CredentialProofData): Promise<CredentialResponse>
{
    const { session } = proofData;
    session.lastUpdatedAt = +new Date()
    session.status = CredentialOfferStatus.CREDENTIAL_REQUEST_RECEIVED;
    issuer.storeSession(session);

    // remove the old nonce and create a new one
    issuer.nonceStates.delete(proofData.nonce);
    const nonce = v4();
    issuer.nonceStates.set(nonce, session.id);

    const {format, credential, signCallback } = await credentialResolver(issuer, proofData)
    if (!credential || !format) {
        throw Error('Could not create a credential');
    }

    await issuer.storeCredential(session, credential);
    let w3cCredential:W3CVerifiableCredential;
    if (typeof signCallback === 'function') {
      w3cCredential = await signCallback(credential);
    }
    else {
        // make sure the issuer field is set
        const baseCredential = credential as CredentialPayload;
        if (!baseCredential.issuer) {
            baseCredential.issuer = issuer.did!.did;
        }
        else if (typeof (baseCredential.issuer) === 'object' && !baseCredential.issuer.id) {
            baseCredential.issuer.id = issuer.did!.did;
        }

        const proofFormat = format?.includes('ld') ? 'lds' : 'jwt';
        const result = await getAgent().createVerifiableCredential({
          credential: credential as CredentialPayload,
          proofFormat,
          removeOriginalFields: false,
          fetchRemoteContexts: true,
          domain: issuer.did!.did
        });
        w3cCredential = (proofFormat === 'jwt' && 'jwt' in result.proof ? result.proof.jwt : result) as W3CVerifiableCredential;
    }
    return { 
        credential: w3cCredential,
        c_nonce: nonce
    };
}
