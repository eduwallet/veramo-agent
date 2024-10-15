
import { getTypesFromRequest, CredentialsSupportedDisplay, CredentialDataSupplierInput} from "@sphereon/oid4vci-common";
import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredential } from "@sphereon/ssi-types"
import moment from 'moment';
import { toStringByJoin } from "@utils/toStringByJoin";
import { BaseCredential } from './BaseCredential';

export class AcademicBaseCredential extends BaseCredential
{
    public async generate(args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
        const types: string[] = getTypesFromRequest(args.credentialRequest, { filterVerifiableCredential: true });
        const display = (this.issuer.metadata.display ?? [{}])[0];

        const credentialId = types[0];
        const credentialConfiguration = this.issuer.getCredentialConfiguration(credentialId);
        const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

        const credential:ICredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ['VerifiableCredential', ...types], // reinsert the filtered-out VerifiableCredential
            "issuer": {
                id: this.issuer.did!.did,
                name: display.name ?? this.issuer.options.baseUrl,
                description: display.description ?? ''
            },
            "iss": this.issuer.did!.did,
            'name': credentialDisplay?.name ?? '',
            'description': credentialDisplay?.description ?? '',
            "issuanceDate": moment().toISOString(),
            "credentialSubject": this.convertDataToClaims(args.credentialDataSupplierInput)
        };

        return await this.handleAttributes(args, types, 'sub', ({
            format: 'jwt_vc_json',
            credential: credential
        } as unknown) as CredentialDataSupplierResult);
    }

    public check(claims: CredentialDataSupplierInput)
    {
        const subject = this.convertDataToClaims(claims);
        if (!this.claimPresent('sub', 'string', subject)) return false;
        if (!this.claimPresent('eduperson_unique_id', 'string', subject)) return false;
        if (!this.claimPresent('given_name', 'string', subject)) return false;
        if (!this.claimPresent('family_name', 'string', subject)) return false;
        if (!this.claimPresent('email', 'string', subject)) return false;
        return true;
    }

    private convertDataToClaims(input:CredentialDataSupplierInput):any {
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
