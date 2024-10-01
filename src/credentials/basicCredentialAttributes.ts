import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredentialStatus } from '@sphereon/ssi-types';
import { Issuer } from "issuer/Issuer";
import moment from 'moment';

export function basicCredentialAttributes(issuer:Issuer, args: CredentialDataSupplierArgs, types:string[], result:CredentialDataSupplierResult): CredentialDataSupplierResult
{
    if (args.credentialDataSupplierInput._exp) {
        result.credential.expirationDate = moment().add(parseInt(args.credentialDataSupplierInput._exp), 's').toISOString();
    }

    const statusses:ICredentialStatus[] = [];
    if (issuer.options.statusLists) {
        for(const cid of types) {
            if (issuer.options.statusLists[cid]) {
                const slist = issuer.options.statusLists[cid];
                const randomIndex = Math.floor(Math.random() * slist.size);
                const entry:ICredentialStatus = {
                    id: slist.url + '#' + randomIndex,
                    type: 'StatusList2021Entry', // should be: 'BitstringStatusListEntry'
                    statusPurpose: slist.purpose,
                    statusListIndex: randomIndex,
                    statusListCredential: slist.url
                } as ICredentialStatus; // we need the cast because ICredentialStatus does not define the purpose, etc.
                statusses.push(entry);
            }
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

    return result;
}