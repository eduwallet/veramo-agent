import Debug from 'debug';
const debug = Debug('issuer:credential');

import moment from "moment";
import { StringKeyedObject } from "#root/types/index";
import { Issuer } from "#root/issuer/Issuer";
import { getCredentialTypeFromConfig } from "#root/utils/getCredentialTypeFromConfig";
import { HolderData } from "#root/types/internal";
import { ExtendableCredentialConfiguration } from '#root/types/api/metadata';
import { StatusListCredentialData } from '#root/types/internal/statuslists';

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
    public presetCredential:any = null; // used for passing a full-blown credential and hoping everything works out
    public callback:string|null = null; // used for retrieving a full-blowb credential over the network
    public metaData:StringKeyedObject = {};
    public dictionary:Dictionary = {};
    public id?:string; // the identifier in the credential data set for this session
    public principalId?:string; // a globally unique identifier for this type and issuer
    public type:string = 'GenericCredential';
    public format:string = 'jwt_vc_json';
    public holder?:HolderData;
    public configuration?:ExtendableCredentialConfiguration;
    public credential:any; // basic readable data
    public output:any; // signed, proofed data, possibly encoded
    public contexts:string[] = [];

    public automaticallyBindHolder = true;

    public setConfiguration(config:ExtendableCredentialConfiguration)
    {
        this.configuration = config;
        this.type = getCredentialTypeFromConfig(config);
        this.format = config.format;
    }

    public async resolve()
    {
        debug('resolving credential data');
        if (this.data?._exp) {
            this.handleExpirationDate(this.data._exp);
            delete this.data._exp;
        }
        if (this.data?._ttl) {
            this.handleExpirationDate(this.data._ttl);
            delete this.data._ttl;
        }
        if (this.metaData.expiration) {
            this.handleExpirationDate(this.metaData.expiration);
        }
        if (process.env.EXPIRATION_DATE) {
            this.handleExpirationDate(process.env.EXPIRATION_DATE);
        }
        debug('setting issuanceDate to now');
        this.metaData.issuanceDate = moment().toISOString();

        // handle the status list information AFTER we set the expiration date, so we
        // can use this to update the last-expiration date of the status list
        const enableLists = (typeof this.metaData?.enableStatusLists === 'undefined') || (this.metaData?.enableStatusLists === true);
        if (this.configuration?.statuslist && enableLists) {
            await this.handleStatusLists();
        }
        debug('end of credential data resolving');
        return true;
    }

    private async handleStatusLists()
    {
        // see if this credential configuration has a status list configuration
        const statusses:StatusListCredentialData[] = [];
        if (this.configuration?.statuslist) {
            for (const statlist of this.configuration.statuslist) {
                const response = await this.issuer!.reserveOnStatusList(statlist, this.metaData.expirationDate);
                statusses.push(response);
            }
        }

        if (statusses.length > 0) {
            this.metaData.credentialStatus = statusses;
        }
    }

    private handleExpirationDate(date?:string)
    {
        let currentDate = this.metaData.expirationDate ? moment(this.metaData.expirationDate) : null;
        let expDate = null;
        if (date && typeof(date) == 'string' && date.indexOf('-') > 0) {
            expDate = moment(date);
        }
        else if (date) {
            expDate = moment().add(parseInt(date.toString()), 's');
        }

        if (expDate) {
            debug('current expiry is ', currentDate, 'vs',expDate);
            if (!currentDate || currentDate.isAfter(expDate)) {
                currentDate = expDate;
            }
            this.metaData.expirationDate = currentDate.toISOString();
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
