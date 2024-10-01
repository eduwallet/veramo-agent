
import { getTypesFromRequest, CredentialsSupportedDisplay, CredentialDataSupplierInput} from "@sphereon/oid4vci-common";
import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredential } from "@sphereon/ssi-types"
import { Issuer } from "issuer/Issuer";
import moment from 'moment';
import { basicCredentialAttributes } from "./basicCredentialAttributes";
import { toStringByJoin } from "@utils/toStringByJoin";

export async function AcademicBaseCredential(issuer:Issuer, args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
    const types: string[] = getTypesFromRequest(args.credentialRequest, { filterVerifiableCredential: true });
    const display = (issuer.metadata.display ?? [{}])[0];

    const credentialId = types[0];
    const credentialConfiguration = issuer.getCredentialConfiguration(credentialId);
    const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

    const credential:ICredential = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "type": types,
        "issuer": {
            id: issuer.did!.did,
            name: display.name ?? issuer.options.baseUrl,
            description: display.description ?? ''
        },
        "iss": issuer.did!.did,
        'name': credentialDisplay?.name ?? '',
        'description': credentialDisplay?.description ?? '',
        "issuanceDate": moment().toISOString(),
        "credentialSubject": convertDataToClaims(args.credentialDataSupplierInput)
    };

    return basicCredentialAttributes(issuer, args, types, ({
        format: 'jwt_vc_json',
        credential: credential
    } as unknown) as CredentialDataSupplierResult);
}

function convertDataToClaims(input:CredentialDataSupplierInput):any {
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
            case 'eduPersonAssurance':
            case 'eduperson_assurance':
                retval[key] = toStringByJoin(input[key]);
                break;
        }
    }
    return retval;
}
