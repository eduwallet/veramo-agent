
import { toStringByJoin } from "utils/toStringByJoin";
import { Credential } from '../Credential';
import { CredentialDisplay } from "types/specification/metadata";
import { CredentialType } from "./CredentialType";

export class AcademicBaseCredential extends CredentialType
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
        },

        credential.data = this.convertDataToClaims(credential.data);
        credential.principalId = credential.data['sub'];
    }

    public check(credential:Credential)
    {
        const subject = this.convertDataToClaims(credential.data);
        if (!this.claimPresent('sub', 'string', subject)) return false;
        if (!this.claimPresent('eduperson_unique_id', 'string', subject)) return false;
        if (!this.claimPresent('given_name', 'string', subject)) return false;
        if (!this.claimPresent('family_name', 'string', subject)) return false;
        if (!this.claimPresent('email', 'string', subject)) return false;
        return true;
    }

    private convertDataToClaims(input:any):any {
        var retval:any = {};
        for (const key of Object.keys(input)) {
            switch (key) {
                case 'sub':
                case 'eduperson_unique_id':
                case 'given_name':
                case 'family_name':
                case 'name':
                case 'schac_home_organisation':
                case 'email':
                case 'eduperson_affiliation':
                case 'eduperson_scoped_affiliation':
                case 'eduperson_entitlement':
                case 'eduperson_assurance':
                    retval[key] = toStringByJoin(input[key]);
                    break;
            }
        }
        return retval;
    }
}
