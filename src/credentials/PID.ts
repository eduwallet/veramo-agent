
import { getTypesFromRequest, CredentialsSupportedDisplay, CredentialDataSupplierInput} from "@sphereon/oid4vci-common";
import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredential } from "@sphereon/ssi-types"
import { Issuer } from "issuer/Issuer";
import moment from 'moment';

// wrapping in square brackets escapes the character
const isoTimeFormat = 'YYYY-MM-DD[T]hh:mm:ss.SSS[Z]';
const pidIssuanceFormat = 'DD-MM-YYYY';

export async function PID(issuer:Issuer, args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
    const types: string[] = getTypesFromRequest(args.credentialRequest, { filterVerifiableCredential: true });
    const display = (issuer.metadata.display ?? [{}])[0];

    const credentialId = types[0];
    const credentialConfiguration = issuer.getCredentialConfiguration(credentialId);
    const credentialDisplay:CredentialsSupportedDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

    const issDate = args.credentialDataSupplierInput['issuance_date'];

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
        "issuanceDate": moment(issDate, pidIssuanceFormat).format(isoTimeFormat),
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
            case "personal_administrative_number":
            case "document_number":
            case "given_name":
            case "family_name":
            case "nationality":
            case "birth_date":
            case "birth_city":
            case "birth_country":
            case "birth_place":
            case "given_name_birth":
            case "family_name_birth":
            case "resident_address":
            case "resident_street":
            case "resident_house_number":
            case "resident_postal_code":
            case "resident_city":
            case "resident_country":
            case "expiry_date":
            case "issuance_date":
            case "issuing_authority":
            case "issuing_jurisdiction":
            case "issuing_country":
            case "portrait":
                retval[key] = toStringByJoin(input[key]);
                break;
            case "age_birth_year":
            case "age_in_years":
            case "age_over_13":
            case "age_over_18":
            case "sex":
                const value = parseFloat(toStringByJoin(input[key]));
                if (!isNaN(value) && value !== null) {
                    retval[key] = value;
                }                
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