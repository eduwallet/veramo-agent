
import { toStringByJoin } from "#root/utils/toStringByJoin";
import { Credential } from '#root/credentials/Credential';
import { CredentialType } from "#root/credentials/types/CredentialType";
import { Session } from "#root/packages/datastore/index";

export class AcademicBaseCredential extends CredentialType
{
    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        credential.data = this.convertDataToClaims(credential.data);
        credential.principalId = credential.data['sub'];
        return true;
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
