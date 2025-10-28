
import { toStringByJoin } from "#root/utils/toStringByJoin";
import { Credential } from '#root/credentials/Credential';
import { CredentialType } from "#root/credentials/types/CredentialType";
import { Session } from "#root/packages/datastore/index";

export class EduID extends CredentialType
{
    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        await this.enrichDataWithCallback(credential, session);
        await this.checkHolderkeyReuse(credential, session);
        credential.data = this.convertDataToClaims(credential.data);
        credential.principalId = credential.data['sub'];
        return true;
    }

    public check(credential:Credential)
    {
        return true;
    }

    private convertDataToClaims(input:any):any {
        var retval:any = {};
        for (const key of Object.keys(input)) {
            switch (key) {
                case 'name':
                case 'given_name':
                case 'family_name':
                case 'schac_home_organisation':
                case 'email':
                case 'eduperson_assurance':
                case 'eduperson_affiliation':
                case 'eduperson_scoped_affiliation':
                    retval[key] = toStringByJoin(input[key]);
                    break;
            }
        }
        return retval;
    }

    private async enrichDataWithCallback(credential:Credential, session:Session)
    {
        const endpoint = credential.issuer?.serverMetadata.userinfo_endpoint;
        try {
            const json = await fetch(endpoint, {
                headers: {
                    'Authorization': 'Bearer ' + session.data.accessToken
                }
            }).then((r) => r.json());
            if (json && Object.keys(json).length > 0) {
                for (const nm of ["name", "given_name", "family_name", "email", "eduperson_assurance", "schac_home_organization", "eduperson_affiliation", "eduperson_scoped_affiliation"]) {
                    if (json[nm]) credential.data[nm] = json[nm];
                }
            }
        }
        catch (e) {
            console.error('Failed to fetch user info endpoint');
            // throw an error, do not issue a credential
            throw e;
        }
    }

    private async checkHolderkeyReuse(credential:Credential, session:Session)
    {
        // a holder key that received a EduID in the past cannot receive a new EduID again
        // UNLESS it is for the same EduID.
    }
}
