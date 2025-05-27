import { CredentialProofData } from "#root/types/internal";

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
}