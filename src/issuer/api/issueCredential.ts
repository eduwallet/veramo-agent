import Debug from 'debug';
const debug = Debug('issuer:api');
import { CredentialPayload, W3CVerifiableCredential } from "@veramo/core";
import { getAgent } from "agent";
import { credentialResolver } from "credentials/credentialResolver";
import { Issuer } from "issuer/Issuer";
import { CredentialOfferStatus } from "types/api";
import { CredentialProofData } from "types/internal";
import { CredentialResponse } from "types/specification/credential_response";
import { createUniqueId } from '#root/utils/createUniqueId';

export async function issueCredential(issuer:Issuer, proofData:CredentialProofData): Promise<CredentialResponse>
{
    debug("issuing credential");
    const { session } = proofData;
    session.lastUpdatedAt = +new Date()

    const nonce = createUniqueId();
    if (issuer.usesNonces) {
        // remove the old nonce and create a new one
        debug("creating a new nonce");
        issuer.nonceStates.delete(proofData.nonce);
        issuer.nonceStates.set(nonce, session.id);
    }

    const {format, credential, signCallback } = await credentialResolver(issuer, proofData)
    if (!credential || !format) {
        debug("error creating actual credential");
        throw Error('Could not create a credential');
    }

    debug("storing credential in the database");
    await issuer.storeCredential(session, credential);
    let w3cCredential:W3CVerifiableCredential;
    if (typeof signCallback === 'function') {
        debug("using callback to sign the credential (sd-jwt)");
        w3cCredential = await signCallback(credential);
    }
    else {
        debug("using veramo directly to sign credential");
        // make sure the issuer field is set
        // Veramo enforces that the issuer field is a valid did identifier, but the spec
        // does not indicate that. The did is actually part of the header with which the
        // credential is signed and not the identifier of the issuer
        // did-jwt-vc transforms issuer.id/issuer to the iss claim, so it is always
        // duplicated. However, this library uses the issuer as passed and only as fallback
        // the iss-claim-as-did, so if veramo would allow it, we could transmit the
        // issuer URL instead.
        // If the issuer would be a URL, we could trace back the original issuer and
        // test the federation linkup
        const baseCredential = credential as CredentialPayload;
        if (!baseCredential.issuer) {
            debug("explicitely setting issuer");
            baseCredential.issuer = issuer.did!.did;
        }
        else if (typeof (baseCredential.issuer) === 'object' && !baseCredential.issuer.id) {
            debug("explicitely setting issuer id");
            baseCredential.issuer.id = issuer.did!.did;
        }

        const proofFormat = format?.includes('ld') ? 'lds' : 'jwt';
        const result = await getAgent().createVerifiableCredential({
          credential: credential as CredentialPayload,
          proofFormat,
          removeOriginalFields: true,
          fetchRemoteContexts: true,
          domain: issuer.did!.did,
          // TODO: This was left out because the Paradym wallet has issues with it. Although the iss claim of the
          // credential is identical to the kid in the header, the Paradym wallet cannot resolve the kid and throws
          // an error. If the kid is left out, it falls back to the iss claim and assumes it is a did. And resolves
          // correctly.
          //header: {
          //  kid: issuer.did!.did
          //}
        });
        w3cCredential = (proofFormat === 'jwt' && 'jwt' in result.proof ? result.proof.jwt : result) as W3CVerifiableCredential;
    }

    debug("updating session status");
    session.status = CredentialOfferStatus.CREDENTIAL_ISSUED;
    issuer.storeSession(session);

    const retval = { 
        credential: w3cCredential,
        ...(issuer.usesNonces ? {c_nonce: nonce} : {})
    };
    debug("returning credential", retval);
    return retval;
}
