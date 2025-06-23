import moment from "moment";
import { StringKeyedObject } from "#root/types/index";
import { CredentialConfiguration } from "#root/types/specification/metadata";
import { Issuer } from "#root/issuer/Issuer";
import { getCredentialTypeFromConfig } from "#root/utils/getCredentialTypeFromConfig";
import { StatusList } from "#root/types/specification/statuslists";

export interface LanguageLabel
{
    value: string;
    locale: string;
}
export interface Dictionary {
    [x:string]: LanguageLabel[];
}

export class Credential
{
    public issuer?:Issuer;
    public data:StringKeyedObject = {};
    public metaData:StringKeyedObject = {};
    public dictionary:Dictionary = {};
    public id?:string; // the identifier in the credential data set for this session
    public principalId?:string; // a globally unique identifier for this type and issuer
    public type:string = 'GenericCredential';
    public holder?:string;
    public configuration?:CredentialConfiguration;
    public credential:any; // basic readable data
    public output:any; // signed, proofed data, possibly encoded
    public contexts:string[] = [];

    public automaticallyBindHolder = true;

    public setConfiguration(config:CredentialConfiguration)
    {
        this.configuration = config;
        this.type = getCredentialTypeFromConfig(config);
    }

    public async resolve()
    {
        if (this.data._exp) {
            this.handleExpirationDate(this.data._exp);
            delete this.data._exp;
        }
        if (this.data._ttl) {
            this.handleExpirationDate(this.data._ttl);
            delete this.data._ttl;
        }
        if (this.metaData.expiration) {
            this.handleExpirationDate(this.metaData.expiration);
        }
        this.metaData.issuanceDate = moment().toISOString();

        const enableLists = (typeof this.metaData.enableStatusLists === 'undefined') || (this.metaData.enableStatusLists === true);
        if (this.issuer!.options.statusLists && enableLists) {
            await this.handleStatusLists();
        }
        return true;
    }

    private async reserveOnStatusList(statusListData:any): Promise<StatusList>
    {
        const listData = await fetch(statusListData.url, {
            method: 'POST',
            body: JSON.stringify({ expirationDate: this.metaData.expirationDate }),
            headers: {
                'Content-type': 'application/json',
                'Authorization': 'Bearer ' + statusListData.token,
                }
        }).then((r) => r.json()).catch((e) => { console.log(e); return null;});

        if (!listData || !listData.url) {
            throw new Error("Unable to contact status server");
        }

        return {
            id: listData.id,
            type: listData.purpose == 'revocation' ? 'RevocationList2021Status' : 'SuspensionList2021Status',
            statusPurpose: listData.purpose,
            statusListIndex: listData.index,
            statusListCredential: listData.url
        };
    }

    private async handleStatusLists()
    {
        const statusses:StatusList[] = [];
        if (this.issuer!.options?.statusLists && this.issuer!.options?.statusLists[this.type!]) {
            const slist = this.issuer!.options.statusLists[this.type!];
            statusses.push(await this.reserveOnStatusList(slist));
        }

        if (statusses.length > 0) {
            if (statusses.length > 1) {
                // cast so we can assign the array as the spec indicates
                this.metaData.credentialStatus = (statusses as unknown) as StatusList;
            }
            else {
                this.metaData.credentialStatus = statusses[0];
            }
        }
    }

    private handleExpirationDate(date:string)
    {
        if (date && date.length) {
            this.metaData.expirationDate = moment().add(parseInt(date), 's').toISOString();
        }
    }

    public addDictionaryValue(key:string, value:string, language:string)
    {
        if (!this.dictionary[key]) {
            this.dictionary[key] = [];
        }
        let found = false;
        this.dictionary[key] = this.dictionary[key].map((v:LanguageLabel) => {
            if (v.locale == language) {
                v.value = value;
                found = true;
            }
            return v;
        });

        if (!found) {
            this.dictionary[key].push({value, locale:language});
        }
    }
}
