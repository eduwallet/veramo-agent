
import { toStringByJoin } from "utils/toStringByJoin";
import { Credential } from '../Credential';
import { CredentialDisplay } from "types/specification/metadata";
import { CredentialType } from "./CredentialType";
import moment from "moment";

const pidIssuanceFormat = 'DD-MM-YYYY';

export class PID extends CredentialType
{
    public async resolve(credential:Credential) {
        const credentialDisplay:CredentialDisplay|undefined = 
        credential.configuration?.display?.length ? (credential.configuration.display[0] as CredentialDisplay) : undefined;

        if (credentialDisplay.name) {
            credential.metaData.name = credentialDisplay.name;
        }
        if (credentialDisplay.description) {
            credential.metaData.description = credentialDisplay.description;
        }

        const display = (credential.issuer.metadata.display ?? [{}])[0];
        credential.metaData.issuer = {
            id: credential.issuer.did!.did,
            name: display.name ?? credential.issuer.options.baseUrl,
            description: display.description ?? ''
        },

        credential.data = this.convertDataToClaims(credential.data);
        credential.principalId = credential.data['personal_administrative_number'];
        credential.metaData.issuanceDate = moment(credential.data['issuance_date'], pidIssuanceFormat).toISOString();
    }

    public check(credential:Credential)
    {
        const subject = this.convertDataToClaims(credential.data);
        if (!this.claimPresent('personal_administrative_number', 'string', subject)) return false;
        if (!this.claimPresent('document_number', 'string', subject)) return false;
        if (!this.claimPresent('given_name', 'string', subject)) return false;
        if (!this.claimPresent('family_name', 'string', subject)) return false;
        if (!this.claimPresent('nationality', 'string', subject)) return false;
        return true;
    }

    private convertDataToClaims(input:any):any {
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
}