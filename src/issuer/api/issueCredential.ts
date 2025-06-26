import Debug from 'debug';
const debug = Debug('issuer:api');
import { Credential } from "#root/credentials/Credential";
import { Issuer } from "#root/issuer/Issuer";
import { CredentialOfferStatus } from "#root/types/api";
import { CredentialProofData } from "#root/types/internal";
import { CredentialResponse } from "#root/types/specification/credential_response";
import { createUniqueId } from '#root/utils/createUniqueId';
import { CredentialFactory } from '#root/credentials/CredentialFactory';
import { Nonce } from '#root/packages/datastore/index';

export async function issueCredential(issuer:Issuer, proofData:CredentialProofData): Promise<CredentialResponse>
{
    debug("issuing credential");
    const { session } = proofData;
    session.data.lastUpdatedAt = +new Date()

    // DIIPv4 compliance: remove generating the following nonce
    let nonce:Nonce|null = null;
    if (issuer.usesNonces) {
        // remove the old nonce and create a new one
        debug("creating a new nonce");
        await issuer.nonceStates.clear(proofData.nonce);
        nonce = await issuer.nonceStates.get('', {session: session.uuid});
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
    credential.metaData = session.data.metaData;
    credential.holder = proofData.did;

    if (!await CredentialFactory.resolve(credential)) {
        debug("error creating actual credential");
        throw Error('Could not create a credential');
    }
    session.data.credential = credential.credential;
    session.data.principalCredentialId = credential.principalId || '';
    session.data.credentialType = credential.type;

    debug("storing credential in the database");
    await issuer.storeCredential(session, credential);

    await CredentialFactory.sign(credential);

    debug("updating session status");
    session.data.status = CredentialOfferStatus.CREDENTIAL_ISSUED;
    await issuer.storeSession(session);

    const retval = { 
        credential: credential.output,
        // in ID2, nonces are retrieved from a nonce endpoint
        // DIIPv4 compliance: remove the next line
        ...((issuer.usesNonces && nonce)? {c_nonce: nonce!.uuid} : {})
    };
    debug("returning credential", retval);
    return retval;
}
