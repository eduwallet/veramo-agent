
import moment from 'moment';
import { getCredentialTypeFromConfig } from "utils/getCredentialTypeFromConfig";
import { toStringByJoin } from "utils/toStringByJoin";
import { BaseCredential } from './BaseCredential';
import { CredentialProofData, CredentialResult } from "types/internal";
import { CredentialDisplay } from "types/specification/metadata";
import { CredentialPayload } from '@veramo/core';

export class AcademicBaseCredential extends BaseCredential
{
    public async generate(proofData:CredentialProofData): Promise<CredentialResult> {
        const display = (this.issuer.metadata.display ?? [{}])[0];
        const { credentialDataSet } = proofData;
        const { credentialConfiguration, data } = credentialDataSet;
        const type = getCredentialTypeFromConfig(credentialConfiguration!);
        const credentialDisplay:CredentialDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

        const credential:CredentialPayload = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ['VerifiableCredential', type],
            "issuer": {
                id: this.issuer.did!.did,
                name: display.name ?? this.issuer.options.baseUrl,
                description: display.description ?? ''
            },
            "iss": this.issuer.did!.did,
            'name': credentialDisplay?.name ?? '',
            'description': credentialDisplay?.description ?? '',
            "issuanceDate": moment().toISOString(),
            "credentialSubject": this.convertDataToClaims(data)
        };

        return await this.handleAttributes(proofData, type, 'sub', {
            format: credentialConfiguration!.format,
            credential: credential
        });
    }

    public check(claims: any)
    {
        const subject = this.convertDataToClaims(claims);
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
