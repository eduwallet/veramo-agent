import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredentialStatus, AdditionalClaims } from '@sphereon/ssi-types';
import { Issuer } from "issuer/Issuer";
import moment from "moment";

export interface ClaimList {
    [x:string]: any
}

export class BaseCredential
{
    public issuer:Issuer;

    public constructor(issuer:Issuer)
    {
        this.issuer = issuer;
    }

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

    public async handleAttributes(args: CredentialDataSupplierArgs, types:string[], principalCredentialId:string, result:CredentialDataSupplierResult): Promise<CredentialDataSupplierResult>
    {
        if (args.credentialDataSupplierInput._exp) {
            result.credential.expirationDate = moment().add(parseInt(args.credentialDataSupplierInput._exp), 's').toISOString();
        }
        if (args.credentialDataSupplierInput._ttl) {
            result.credential.expirationDate = moment().add(parseInt(args.credentialDataSupplierInput._ttl), 's').toISOString();
        }
    
        const metadata = JSON.parse(args.credentialDataSupplierInput._meta || '{}');
        if (this.issuer.options.statusLists && (metadata.enableStatusLists || typeof(metadata.enableStatusLists) == 'undefined')) {
            const statusses:ICredentialStatus[] = [];
            for(const cid of types) {
                if (this.issuer.options.statusLists[cid]) {
                    const slist = this.issuer.options.statusLists[cid];
                    const listData = await fetch(slist.url, {
                        method: 'POST',
                        body: JSON.stringify({ expirationDate: result.credential.expirationDate }),
                        headers: {
                            'Content-type': 'application/json',
                            'Authorization': 'Bearer ' + slist.token,
                          }
                    }).then((r) => r.json()).catch((e) => { console.log(e); return null;});
    
                    if (!listData || !listData.url) {
                        throw new Error("Unable to contact status server");
                    }
    
                    const entry:ICredentialStatus = {
                        id: listData.id,
                        type: 'StatusList2021Entry', // should be: 'BitstringStatusListEntry'
                        statusPurpose: listData.purpose,
                        statusListIndex: listData.index,
                        statusListCredential: listData.url
                    } as ICredentialStatus; // we need the cast because ICredentialStatus does not define the purpose, etc.
                    statusses.push(entry);
                }
            }
            if (statusses.length > 0) {
                if (statusses.length > 1) {
                    // we need the cast because ICredentialStatus does not allow an array of statusses (yet)
                    result.credential.credentialStatus = (statusses as unknown) as ICredentialStatus;
                }
                else {
                    result.credential.credentialStatus = statusses[0];
                }
            }
        }
    
        var session = await this.issuer.getSessionById(args.issuerState || args.preAuthorizedCode || '');
        session.credential = result;
        session.principalCredentialId = (result.credential.credentialSubject as AdditionalClaims)[principalCredentialId] || '';
        this.issuer.sessionData.set(session.state, session);
        return result;
    }
}