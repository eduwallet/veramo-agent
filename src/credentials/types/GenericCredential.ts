import { CredentialType } from './CredentialType';
import { CredentialDisplay } from "types/specification/metadata";
import { Credential } from '../Credential';
import { createUniqueId } from '#root/utils/createUniqueId';

export class GenericCredential extends CredentialType
{
    public async resolve(credential:Credential) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        const context = credential.issuer.getCredentialContext(credential.type);
        if (context) {
            credential.contexts.push(context);
        }
        credential.principalId = createUniqueId();
    }

    public check(credential:Credential)
    {
        return true;
    }
}
