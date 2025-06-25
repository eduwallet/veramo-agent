import Debug from 'debug';
const debug = Debug('issuer:api');
import { Credential } from "#root/credentials/Credential";
import { Issuer } from "#root/issuer/Issuer";
import { CredentialOfferStatus } from "#root/types/api";
import { CredentialProofData } from "#root/types/internal";
import { CredentialResponse } from "#root/types/specification/credential_response";
import { createUniqueId } from '#root/utils/createUniqueId';
import { CredentialFactory } from '#root/credentials/CredentialFactory';

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

    const credential = new Credential();
    credential.issuer = issuer;
    credential.id = proofData.credentialDataSet.credentialId;
    credential.setConfiguration(issuer.getCredentialConfiguration(credential.id)!);

    // the format parameter can have an internal and an external value... not ideal
    // if we have an internal value, set it as the credential format instead of the
    // format defined by the external one in the configuration above
    if (proofData.credentialDataSet.credentialConfiguration.format) {
        credential.format = proofData.credentialDataSet.credentialConfiguration.format;
    }
    // format is a part of the configuration. CredentialId defines a single format
    // We can only use format if we use credentialType to indicate a type and 
    // format to indicate format, whose combination would lead to a credentialId
    // credential.format = proofData.format;
    credential.data = proofData.credentialDataSet.data;
    credential.metaData = session.metaData;
    credential.holder = proofData.did;

    if (!await CredentialFactory.resolve(credential)) {
        debug("error creating actual credential");
        throw Error('Could not create a credential');
    }
    session.credential = credential.credential;
    session.principalCredentialId = credential.principalId || '';
    session.credentialType = credential.type;

    debug("storing credential in the database");
    await issuer.storeCredential(session, credential);

    await CredentialFactory.sign(credential);

    debug("updating session status");
    session.status = CredentialOfferStatus.CREDENTIAL_ISSUED;
    issuer.storeSession(session);

    const retval = { 
        credential: credential.output,
        ...(issuer.usesNonces ? {c_nonce: nonce} : {})
    };
    debug("returning credential", retval);
    return retval;
}
