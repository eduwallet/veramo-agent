
import { getTypesFromRequest, CredentialsSupportedDisplay, CredentialDataSupplierInput} from "@sphereon/oid4vci-common";
import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredential } from "@sphereon/ssi-types"
import { Issuer } from "issuer/Issuer";
import {format} from 'date-fns'

const isoTimeFormat = 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'';

export async function AcademicBaseCredential(issuer:Issuer, args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
    const types: string[] = getTypesFromRequest(args.credentialRequest, { filterVerifiableCredential: true });
    const display = (issuer.metadata.display ?? [{}])[0];

    const credentialId = types[0];
    const credentialConfiguration = issuer.getCredentialConfiguration(credentialId);
    const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

    // construction with a cast, because we do not yet know the actual issuer key id
    // that is used to sign the ICredential, but the type definition requires it
    const credential:ICredential = ({
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        "type": types,
        "issuer": {
            //id: this.issuer.metadata.credential_issuer,
            // additional, not further specified data about the issuer
            // This would be wallet-dependent
            name: display.name ?? issuer.metadata.credential_issuer,
            description: display.description ?? ''
        },
        'name': credentialDisplay?.name ?? '',
        'description': credentialDisplay?.description ?? '',
        "issuanceDate": format(new Date(), isoTimeFormat),
        "credentialSubject": convertDataToClaims(args.credentialDataSupplierInput)
    } as unknown) as ICredential;
    return ({
        format: 'jwt_vc_json',
        credential: credential
    } as unknown) as CredentialDataSupplierResult;
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
            case 'shac_home_organisation':
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

function toStringByJoin(key:string|string[]):string {
    if (Array.isArray(key)) {
        return key.join(',');
    }
    return key;
}