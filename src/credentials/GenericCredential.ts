
import { getTypesFromRequest, CredentialsSupportedDisplay, CredentialDataSupplierInput} from "@sphereon/oid4vci-common";
import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredential } from "@sphereon/ssi-types"
import moment from 'moment';
import { getCredentialTypeFromConfig } from "utils/getCredentialTypeFromConfig";
import { BaseCredential } from './BaseCredential';

export class GenericCredential extends BaseCredential
{
    public async generate(args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
        const display = (this.issuer.metadata.metadata.display ?? [{}])[0];
        const credentialConfiguration = this.issuer.getCredentialConfiguration(this.credentialId);
        const types = getCredentialTypeFromConfig(credentialConfiguration!);
        const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

        const credential:ICredential = {
            "@context": ["https://www.w3.org/2018/credentials/v1"],
            "type": ['VerifiableCredential', ...types],
            "issuer": {
                id: this.issuer.did!.did,
                name: display.name ?? this.issuer.options.baseUrl,
                description: display.description ?? ''
            },
            "iss": this.issuer.did!.did,
            'name': credentialDisplay?.name ?? '',
            'description': credentialDisplay?.description ?? '',
            "issuanceDate": moment().toISOString(),
            "credentialSubject": args.credentialDataSupplierInput
        };

        if (credentialConfiguration!.format == 'ldp_vc') {
            credential['@context'] = ["https://www.w3.org/2018/credentials/v1"].concat(this.issuer.getCredentialContext(this.credentialId));
            
        }

        return await this.handleAttributes(args, types, '', ({
            format: credentialConfiguration!.format,
            credential: credential
        } as unknown) as CredentialDataSupplierResult);
    }

    public check(claims: CredentialDataSupplierInput)
    {
        return true;
    }
}
