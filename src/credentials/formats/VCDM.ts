import Debug from 'debug';
const debug = Debug('issuer:vcdm');

import { LanguageObject, VCDM as VCDMType} from './VCDMTypes';
import { Credential } from '../Credential';
import moment from 'moment';

export class VCDM
{
    private credential:Credential;

    public constructor(credential:Credential)
    {
        this.credential = credential;
    }

    public build():VCDMType
    {
        debug("creating VCDM");

        const issuerName = this.createLanguageObject('issuer_name');
        const issuerDescription = this.createLanguageObject('issuer_description');
        let baseCredential:VCDMType = {
            "@context": ["https://www.w3.org/ns/credentials/v2", ...this.credential.contexts],
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
        // name and description can be language objects
        if (this.credential.dictionary['name']) {
            baseCredential.name = this.createLanguageObject('name');
        }
        if (this.credential.dictionary['description']) {
            baseCredential.description = this.createLanguageObject('description');
        }

        // Each object MAY also contain an id property to identify the subject, as described in Section 4.4 Identifiers.
        if (this.credential.automaticallyBindHolder && !baseCredential.credentialSubject.id && this.credential.holder) {
            baseCredential.credentialSubject.id = this.credential.holder;
        }

        if (this.credential.metaData.issuanceDate) {
            baseCredential.validFrom = moment(this.credential.metaData.issuanceDate).format('YYYY-MM-DDTHH:mm:ssZ');
        }
        else {
            baseCredential.validFrom = moment().format('YYYY-MM-DDTHH:mm:ssZ');
        }
        if (this.credential.metaData.expirationDate) {
            baseCredential.validUntil = moment(this.credential.metaData.expirationDate).format('YYYY-MM-DDTHH:mm:ssZ');
        }

        this.addStatusListData(baseCredential);
        return baseCredential;
    }

    private createLanguageObject(value:string)
    {
        if (this.credential.dictionary[value]) {
            let retval:LanguageObject[] = [];
            for (const label of this.credential.dictionary[value]) {
                retval.push({
                    "@value": label.value,
                    "@language": label.locale
                });
            }
            return retval;
        }
        return '';
    }

    private addStatusListData(baseCredential:VCDMType)
    {
        if (this.credential.metaData.credentialStatus) {
            if (this.credential.metaData.credentialStatus.type) {
                // only one entry
                baseCredential.status = [Object.assign({}, this.credential.metaData.credentialStatus)];
            }
            else if (this.credential.metaData.credentialStatus.length) {
                // array of entries
                baseCredential.status = this.credential.metaData.credentialStatus.slice();
            }
        }
    }
}