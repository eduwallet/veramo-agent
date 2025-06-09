
import moment from 'moment';
import { getCredentialTypeFromConfig } from "utils/getCredentialTypeFromConfig.js";
import { toStringByJoin } from "utils/toStringByJoin.js";
import { BaseCredential } from './BaseCredential.js';
import { CredentialProofData, CredentialResult } from "types/internal.js";
import { CredentialDisplay } from "types/specification/metadata.js";
import { CredentialPayload } from '@veramo/core';

export class AcademicEnrollmentCredential extends BaseCredential
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
            format: 'jwt_vc_json',
            credential: credential
        });
    }

    public check(claims: any)
    {
        const subject = this.convertDataToClaims(claims);
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
