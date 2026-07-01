import Debug from 'debug';
const debug = Debug('issuer:credentialtype');

import { Session } from "#root/database/entities/index";
import { CredentialConfigurationClaimData } from "#root/types/api/metadata";
import { Credential } from "../Credential.js";

export interface ClaimList {
    [x:string]: any
}

export abstract class CredentialType
{
    public abstract check(credential:Credential):boolean;
    public abstract resolve(credential:Credential, session:Session):Promise<boolean>;
    
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
        if (credential.configuration?.credential_metadata?.display) {
            for (const display of credential.configuration.credential_metadata.display) {
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
            const metadata = credential.issuer.generateMetadata();
            const display = (metadata.display ?? [{}]);
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

    public async retrieveExternalCredential(credential:Credential, session:Session)
    {
        if (credential.callback !== null) {
            const result = await fetch(credential.callback, {
                method: 'POST',
                body: JSON.stringify(session.data.accessData),
                headers: {
                    'Content-type': 'application/json'
                }
            });

            if (result.status == 200) {
                credential.presetCredential = await result.json();
            }
            else {
                throw new Error("Credential denied");
            }
        }
    }

    public convertConfigToClaimsPaths(credential:Credential)
    {
        // we use the internal credential configuration in credential.configuration. That can contain a
        //    credential_definition.claims[]
        // or
        //    credential_definition.credentialSubject.<claim>
        // configuration
        // This routine converts both options into an array of claims, much like the issue convertTo<Format> library functions do
        // We used to use the decorated (and transformed) credentials, but these will not have the origin attribute
        // that we need here.
        let claims:CredentialConfigurationClaimData[] = [];
        if (credential.configuration.credential_definition?.claims) {
            // make sure every claim has an appropiate origin
            for (const claim of credential.configuration.credential_definition?.claims) {
                const newclaim = Object.assign({}, claim);
                if (!newclaim.origin) {
                    newclaim.origin = [newclaim.path];
                }
                claims.push(newclaim);
            }
        }

        for (const key of Object.keys(credential.configuration.credential_definition?.credentialSubject ?? {})) {
            const value = credential.configuration.credential_definition.credentialSubject![key];
            // at this point we only support simple claims: single path elements
            // for more complicated claims, populate the claims attribute directly
            let path = ['credentialSubject', key];
            // by default, the origin is the attribute in the gathered data that is named the same as the output claim
            // the origin is an array-of-paths
            let origin = value.origin ?? [[key]];
            const claim:CredentialConfigurationClaimData = {
                path,
                origin
            };
            claims.push(claim);
        }
        return claims;
    }

    public getAttributeFromPath(data:any, path:string[]): any
    {
        if (path.length == 0) {
            return null;
        }
        const key = path[0];
        if (key in data) {
            if (path.length == 1) {
                return data[key];
            }
            else {
                return this.getAttributeFromPath(data[key], path.slice(1));
            }
        }
        return null;
    }

    public setAttributeUsingPath(result:any, path:string[], value:any) {
        if (value === null) {
            return result; // do not set anything
        }
        if (path.length == 1) {
            // if the original result is not an object on which we can set a key, drop it and replace it
            if (typeof(result) != 'object') {
                result = {};
            }
            result[path[0]] = value;
        }
        else {
            if (!(path[0] in result)) {
                result[path[0]] = {};
            }
            result[path[0]] = this.setAttributeUsingPath(result[path[0]], path.slice(1), value);
        }
        return result;
    }

    public copyClaimsFromOrigin(credential:Credential, accessData:any)
    {
        const pathsAndOrigins = this.convertConfigToClaimsPaths(credential);
        let result:any = credential.data;

        for (const path of pathsAndOrigins) {
            for (const origin of path.origin!) {
                // origin is an array of strings
                let value;
                debug("copying value for ", path, " from ", origin);
                switch (origin[0]) {
                    case '#accessData':
                        debug("getting origin from accessData");
                        value = this.getAttributeFromPath(accessData, origin.slice(1));
                        break;
                    default:
                        value = this.getAttributeFromPath(credential.data, origin);
                        break;
                }
                if (typeof(value) != 'undefined' && value !== null) {
                    debug("value found, setting on result");
                    result = this.setAttributeUsingPath(result, path.path, value);
                    break; // take the first valid value we find
                }
            }
        }
        debug("resulting credential data" , result);
        credential.data = result;
    }
}