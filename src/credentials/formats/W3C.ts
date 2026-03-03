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
        let context = (this.credential.contexts ?? []).slice();
        if (!context.includes('https://www.w3.org/2018/credentials/v1')) {
            context.unshift('https://www.w3.org/2018/credentials/v1');
        }
        let baseCredential:W3CType = {
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

        // if we have issuer metadata, allow enriching our basic information
        if (this.credential.metaData.issuer) {
            baseCredential.issuer = Object.assign({}, this.credential.metaData.issuer, baseCredential.issuer);
        }

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

        this.addStatusListData(baseCredential);
        this.addEvidenceData(baseCredential);

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

    private addStatusListData(baseCredential:W3CType)
    {
        if (this.credential.metaData.credentialStatus) {
            if (this.credential.metaData.credentialStatus.type) {
                // only one entry
                // The status list agent returns a correct credentialStatus element in the credentialStatus attribute
                if (this.credential.metaData.credentialStatus.type != 'statuslist+jwt') {
                    // IETF says the the status claim is a JWT claim, not a VC claim, so we skip it
                    baseCredential.credentialStatus = [Object.assign({}, this.credential.metaData.credentialStatus.credentialStatus)];
                }
            }
            else if (this.credential.metaData.credentialStatus.length) {
                // array of entries
                // Return only the status list elements of the non-IETF statusses. We add the JWT claim later on
                baseCredential.credentialStatus = this.credential.metaData.credentialStatus
                    .filter((el:any) => el.type != 'statuslist+jwt')
                    .map((el:any) => el.credentialStatus);
            }
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
}