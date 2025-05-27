import moment from "moment";
import { CredentialStatusReference } from "@veramo/core";
import { StringKeyedObject } from "#root/types/index";
import { CredentialConfiguration } from "#root/types/specification/metadata";
import { CredentialType } from "./types/CredentialType";
import { Issuer } from "#root/issuer/Issuer";
import { getCredentialTypeFromConfig } from "#root/utils/getCredentialTypeFromConfig";
import { SDJWT } from "./formats/SDJWT.js";

export class Credential
{
    public issuer?:Issuer;
    public data:StringKeyedObject = {};
    public metaData:StringKeyedObject = {};
    public id?:string; // the identifier in the credential data set for this session
    public principalId?:string; // a globally unique identifier for this type and issuer
    public type:string = 'GenericCredential';
    public holder?:string;
    public configuration?:CredentialConfiguration;
    public credential:any; // basic readable data
    public output:any; // signed, proofed data, possibly encoded
    public contexts:string[] = ["https://www.w3.org/2018/credentials/v1"];

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
        if (this.automaticallyBindHolder) {
            this.bindHolder();
        }
        this.metaData.issuanceDate = moment().toISOString();

        const enableLists = (typeof this.metaData.enableStatusLists === 'undefined') || (this.metaData.enableStatusLists === true);
        if (this.issuer!.options.statusLists && enableLists) {
            await this.handleStatusLists();
        }
        return true;
    }

    private async reserveOnStatusList(statusListData:any): Promise<CredentialStatusReference>
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
            type: 'StatusList2021Entry', // should be: 'BitstringStatusListEntry'
            statusPurpose: listData.purpose,
            statusListIndex: listData.index,
            statusListCredential: listData.url
        };
    }

    private async handleStatusLists()
    {
        const statusses:CredentialStatusReference[] = [];
        if (this.issuer!.options.statusLists[this.type!]) {
            const slist = this.issuer!.options.statusLists[this.type!];
            statusses.push(await this.reserveOnStatusList(slist));
        }

        if (statusses.length > 0) {
            if (statusses.length > 1) {
                // cast so we can assign the array as the spec indicates
                this.metaData.credentialStatus = (statusses as unknown) as CredentialStatusReference;
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

    private bindHolder()
    {
        // Bind credential to the provided proof of possession
        if (['dc+sd-jwt', 'vc+sd-jwt'].includes(this.type)) {
            // https://www.rfc-editor.org/rfc/rfc7800.html
            if (!this.metaData.metaData.cnf) {
                this.metaData.cnf = {kid: this.holder};
            }
        }
        else {
            // the credentialSubject can be a single object, or an array of objects. 
            // If it is an array, it supposedly refers to several subjects and we cannot
            // simply guess which is the actual holder, nor if all refer to the holder
            // Hence we only do automatic holder binding if the credentialSubject is not a list
            if (!Array.isArray(this.data) && this.data.id) {
                this.data.id = this.holder;
            }
        }
    }
}

