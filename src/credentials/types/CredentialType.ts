import { CredentialProofData } from "#root/types/internal";
import { CredentialDisplay } from "#root/types/specification/metadata";
import { Credential } from "../Credential.js";

export interface ClaimList {
    [x:string]: any
}

export abstract class CredentialType
{
    public abstract check(credential:Credential):boolean;
    public abstract resolve(credential:Credential, proofData:CredentialProofData):Promise<boolean>;
    
    protected claimPresent(claim:string, type:string, claims:ClaimList)
    {
        if (typeof(claims[claim]) != 'undefined' && claims[claim] !== null) {
            // do not allow empty strings as proper string value
            if (typeof(claims[claim]) == 'string' && claims[claim] === '') {
                return false;
            }
            if (type != 'any' && typeof(claims[claim]) != type) {
                return false;
            }
            return true;
        }
        return false;
    }

    protected setCredentialDisplay(credential:Credential)
    {
        if (credential.configuration?.display) {
            for (const display of credential.configuration.display) {
                if (display.name) {
                    credential.addDictionaryValue('name', display.name, display.locale ?? 'en_US');
                }
                if (display.description) {
                    credential.addDictionaryValue('description', display.description, display.locale ?? 'en_US');
                }
            }
        }
    }

    protected setIssuer(credential:Credential)
    {
        if (credential.issuer) {
            const display = (credential.issuer.metadata.display ?? [{}]);
            for (const label of display) {
                if (label.name) {
                    credential.addDictionaryValue('issuer_name', label.name, label.locale ?? 'en_US');
                }
                else {
                    credential.addDictionaryValue('issuer_name', credential.issuer.options.baseUrl, label.locale ?? 'en_US');
                }
                if (label.description) {
                    credential.addDictionaryValue('issuer_description', label.description, label.locale ?? 'en_US');
                }
            }

            if (!display || display.length == 0) {
                credential.addDictionaryValue('issuer_name', credential.issuer.options.baseUrl, 'en_US');
            }
        }
    }
}