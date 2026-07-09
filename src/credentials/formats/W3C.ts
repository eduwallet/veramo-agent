import Debug from 'debug';
const debug = Debug('issuer:vcdm');

import { Credential } from '#root/credentials/Credential';
import moment from 'moment';
import { W3CJWT, W3C as W3CType } from '#root/credentials/formats/VCDMTypes';
import { HolderData } from '#root/types/internal';

// https://www.w3.org/TR/vc-data-model/

export class W3C
{
    private credential:Credential;

    public constructor(credential:Credential)
    {
        this.credential = credential;
    }

    public async build():Promise<W3CJWT>
    {
        debug("creating W3C");

        const issuerName = this.getString('issuer_name');
        const issuerDescription = this.getString('issuer_description');
        const context = (this.credential.contexts ?? []).slice();
        if (!context.includes('https://www.w3.org/2018/credentials/v1')) {
            context.unshift('https://www.w3.org/2018/credentials/v1');
        }
        const baseCredential:W3CType = {
            // The value of the @context property MUST be an ordered set where the first item is a URI with the value https://www.w3.org/2018/credentials/v1.
            "@context": context,
            type: ["VerifiableCredential", this.credential.type],
            credentialSubject: Object.assign({}, this.credential.data),
            issuer: {
                // value of id can be a controlled identifier, a JWK (reference) or a did. In fact, it can be any url
                id: this.credential.issuer!.did!.did,
                ...(issuerName != '' ? {name: issuerName} : {}),
                ...(issuerDescription != '' ? {description: issuerDescription} : {}),
            }
        };

        // If present, id property's value MUST be a single URL, recommended to be machine readable

        // Each object MAY also contain an id property to identify the subject, as described in Section 4.2 Identifiers.
        if (this.credential.automaticallyBindHolder && !baseCredential.credentialSubject.id && this.credential.holder) {
            baseCredential.credentialSubject.id = await this.convertHolderToDid(this.credential.holder);
        }

        if (this.credential.dictionary['name']) {
            baseCredential.name = this.getString('name');
        }
        if (this.credential.dictionary['description']) {
            baseCredential.description = this.getString('description');
        }

        if (this.credential.metaData.issuanceDate) {
            debug('issuanceDate is set to ', this.credential.metaData.issuanceDate);
            baseCredential.issuanceDate = moment(this.credential.metaData.issuanceDate).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        else {
            debug('no issuance date set, setting to now', this.credential.metaData);
            baseCredential.issuanceDate = moment().format('YYYY-MM-DDTHH:mm:ssZ');
        }
        if (this.credential.metaData.expirationDate) {
            baseCredential.expirationDate = moment(this.credential.metaData.expirationDate).format('YYYY-MM-DDTHH:mm:ssZ');
        }

        this.addOIDFedMetadata(baseCredential, this.credential.issuer?.options.baseUrl);
        this.addStatusListData(baseCredential);
        this.addEvidenceData(baseCredential);
        this.addOtherMetadata(baseCredential);

        return { vc: baseCredential };
    }

    private async convertHolderToDid(holder:HolderData):Promise<string>
    {
        if ((holder.type == "kid" || holder.type == "jwk") && holder.data) {
            return holder.data;
        }
        throw new Error("W3C not applicable for x5c holding JWT proofs");
    }

    private getString(value:string)
    {
        if (this.credential.dictionary[value]) {
            let retval:string = '';
            for (const label of this.credential.dictionary[value]) {
                retval = label.value;
                break;
            }
            return retval;
        }
        return '';
    }

    private addOIDFedMetadata(baseCredential:W3CType, entity?:string)
    {

        if (!baseCredential.termsOfUse) {
            baseCredential.termsOfUse = {
                "type": "OpenIDFederation",
                "policyId": entity
            };
        }
        else {
            if (!Array.isArray(baseCredential.termsOfUse) && baseCredential.termsOfUse.type != 'OpenIDFederation') {
                baseCredential.termsOfUse = [baseCredential.termsOfUse];
                baseCredential.termsOfUse.push({
                    "type": "OpenIDFederation",
                    "policyId": entity
                });
            }
            else if(Array.isArray(baseCredential.termsOfUse)) {
                const hasOIDFed = baseCredential.termsOfUse.filter((i) => i.type == 'OpenIDFederation').length  > 0;
                if (!hasOIDFed) {
                    baseCredential.termsOfUse.push({
                        "type": "OpenIDFederation",
                        "policyId": entity
                    }); 
                }
            }
        }
    }
    
    private addStatusListData(baseCredential:W3CType)
    {
        // status list data should _always_ be added by the issuer, never by passing prefabricated data.
        // Hence we can be more or less sure of the constitution of the data at this point. It should contain
        // ready to consume StatusListCredentialAttributes
        if (this.credential.metaData.credentialStatus) {
            // array of entries
            // the ietf version does not have a type attribute
            baseCredential.credentialStatus = this.credential.metaData.credentialStatus
                .filter((el:any) => typeof(el.type) != 'undefined');
        }
    }

    private addEvidenceData(baseCredential:W3CType)
    {
        if (this.credential.metaData.evidence) {
            if (this.credential.metaData.evidence.type) {
                // only one entry
                baseCredential.evidence = [Object.assign({}, this.credential.metaData.evidence)];
            }
            else if (this.credential.metaData.evidence.length) {
                // array of entries
                baseCredential.evidence = this.credential.metaData.evidence.slice();
            }
        }
    }

    private addOtherMetadata(baseCredential:W3CType)
    {
        // this only works on the OpenBadgeCredential, because the other types cannot set other metadata
        for (const key of Object.keys(this.credential.metaData)) {
            switch (key) {
                case 'evidence':
                case 'credentialStatus':
                case 'issuanceDate':
                case 'expirationDate':
                    // pass
                    break;
                case 'issuer':
                    baseCredential.issuer = Object.assign({}, this.credential.metaData.issuer, baseCredential.issuer);
                    // make sure our issuer.id is set correctly though
                    if (typeof(baseCredential.issuer) == 'object') {
                        baseCredential.issuer.id = this.credential.issuer!.did!.did;
                    }
                    else {
                        baseCredential.issuer = this.credential.issuer!.did!.did;
                    }
                    break;
                default:
                    baseCredential[key] = this.credential.metaData[key];
                    break;
            }
        }
    }
}