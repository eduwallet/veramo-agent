import { toStringByJoin } from "utils/toStringByJoin";
import { CredentialDisplay } from "types/specification/metadata";
import { CredentialType } from './CredentialType';
import { Credential } from '../Credential';
import { createUniqueId } from "#root/utils/createUniqueId";

export class AcademicEnrollmentCredential extends CredentialType
{
    public async resolve(credential:Credential) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        credential.data = this.convertDataToClaims(credential.data);
        credential.principalId = createUniqueId(); // this credential does not have a unique identifier
        return true;
    }

    public check(credential:Credential)
    {
        const subject = this.convertDataToClaims(credential.data);
        if (!this.claimPresent('crohoCreboCode', 'string', subject)) return false;
        if (!this.claimPresent('name', 'string', subject)) return false;
        if (!this.claimPresent('phase', 'string', subject)) return false;
        if (!this.claimPresent('modeOfStudy', 'string', subject)) return false;
        if (!this.claimPresent('institutionBRINCode', 'string', subject)) return false;
        if (!this.claimPresent('startDate', 'string', subject)) return false;
        if (!this.claimPresent('endDate', 'string', subject)) return false;
        return true;
    }

    private convertDataToClaims(input:any):any {
        var retval:any = {};
        for (const key of Object.keys(input)) {
            switch (key) {
                case 'crohoCreboCode':
                case 'name':
                case 'phase':
                case 'modeOfStudy':
                case 'startDate':
                case 'endDate':
                case 'institutionBRINCode':
                    retval[key] = toStringByJoin(input[key]);
                    break;
            }
        }
        return retval;
    }
}
