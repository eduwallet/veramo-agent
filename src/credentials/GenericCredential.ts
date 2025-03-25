
import moment from 'moment';
import { getCredentialTypeFromConfig } from "utils/getCredentialTypeFromConfig";
import { BaseCredential } from './BaseCredential';
import { CredentialProofData, CredentialResult } from "types/internal";
import { CredentialDisplay } from "types/specification/metadata";
import { CredentialPayload } from '@veramo/core';

export class GenericCredential extends BaseCredential
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
            "credentialSubject": data
        };

        if (credentialConfiguration!.format == 'ldp_vc') {
            credential['@context'] = ["https://www.w3.org/2018/credentials/v1"].concat(this.issuer.getCredentialContext(this.credentialId));
        }

        return await this.handleAttributes(proofData, type, '', {
            format: credentialConfiguration!.format,
            credential: credential
        });
    }

    public check(claims: any)
    {
        return true;
    }
}
