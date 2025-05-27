import { CredentialType } from './CredentialType';
import { CredentialDisplay } from "types/specification/metadata";
import { Credential } from '../Credential';
import { createUniqueId } from '#root/utils/createUniqueId';

export class GenericCredential extends CredentialType
{
    public async resolve(credential:Credential) {
        const credentialDisplay:CredentialDisplay|undefined = 
            credential.configuration?.display?.length ? (credential.configuration.display[0] as CredentialDisplay) : undefined;

        if (credentialDisplay.name) {
            credential.metaData.name = credentialDisplay.name;
        }
        if (credentialDisplay.description) {
            credential.metaData.description = credentialDisplay.description;
        }

        const display = (credential.issuer.metadata.display ?? [{}])[0];
        credential.metaData.issuer = {
            id: credential.issuer.did!.did,
            name: display.name ?? credential.issuer.options.baseUrl,
            description: display.description ?? ''
        };

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
