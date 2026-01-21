import { CredentialType } from '#root/credentials/types/CredentialType';
import { Credential } from '#root/credentials/Credential';
import { createUniqueId } from '#root/utils/createUniqueId';
import { Session } from '#root/database/entities/index';

export class GenericCredential extends CredentialType
{
    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        const context = credential.issuer?.getCredentialContext(credential.type);
        if (context) {
            for (const ctx of context) {
                credential.contexts.push(ctx);
            }
        }
        credential.principalId = createUniqueId();
        return true;
    }

    public check(credential:Credential)
    {
        return true;
    }
}
