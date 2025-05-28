import Debug from 'debug';
const debug = Debug('issuer:vcdm');

import { LanguageObject, VCDM as VCDMType} from './VCDMTypes';
import { Credential } from '../Credential';
import moment from 'moment';
import { JWT } from '#root/jwt/JWT';

export class VCDM
{
    private credential:Credential;
    private type:string = 'jose';
    public constructor(credential:Credential, type:string = 'jose')
    {
        this.credential = credential;
        this.type = type;
    }

    public async sign()
    {
        debug("signing VCDM");

        const issuerName = this.createLanguageObject('issuer_name');
        const issuerDescription = this.createLanguageObject('issuer_description');
        let baseCredential:VCDMType = {
            "@context": ["https://www.w3.org/ns/credentials/v2", ...this.credential.contexts],
            type: ["VerifiableCredential", this.credential.type],
            credentialSubject: this.credential.data,
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
   
        this.credential.output = await this.packCredential(baseCredential);
    }

    private async packCredential(baseCredential:VCDMType)
    {
        switch(this.type) {
            default:
            case 'jose':
                return this.packCredentialAsJose(baseCredential);
        }
    }

    private async packCredentialAsJose(baseCredential:VCDMType)
    {
        // https://www.w3.org/TR/vc-jose-cose/
        // https://www.w3.org/TR/vc-jose-cose/#securing-with-jose
        // "The unsecured verifiable credential is the payload"
        const jwt = new JWT();
        jwt.payload = baseCredential;

        jwt.header.alg = this.credential.issuer!.algorithm();
        jwt.header.kid = this.credential.issuer!.did!.did + '#' + this.credential.issuer!.keyRef;
        jwt.header.typ = 'vc+jwt';
        jwt.header.cty = 'vc';

        // It is RECOMMENDED to use the IANA JSON Web Token Claims registry and the IANA JSON
        // Web Signature and Encryption Header Parameters registry to identify any claims and
        // header parameters that might be confused with members defined by [VC-DATA-MODEL-2.0].
        // These include but are not limited to: iss, kid, alg, iat, exp, and cnf. 
        jwt.header.iss = this.credential.issuer!.did!.did;

        // When the iat (Issued At) and/or exp (Expiration Time) JWT claims are present, they 
        // represent the issuance and expiration time of the signature, respectively.
        jwt.payload.iss = moment().unix();
        if (this.credential.metaData.expirationDate) {
            // signature at least expires at the expiration date of the credential itself
            jwt.payload.iat = moment(this.credential.metaData.expirationDate).unix();
        }

        // Implementers SHOULD avoid setting JWT claims to values that conflict with the values of
        // verifiable credential properties when a claim and property pair refer to the same
        // conceptual entity, especially with pairs such as iss and issuer, jti and id, and
        // sub and credentialSubject.id.
        jwt.payload.iss = this.credential.issuer!.did!.did;
        if (baseCredential.id) {
            jwt.payload.jti = baseCredential.id;
        }
        if (baseCredential.credentialSubject.id) {
            jwt.payload.sub = baseCredential.credentialSubject.id;
        }

        return await this.credential.issuer!.signToken(jwt);
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
                baseCredential.status = [this.credential.metaData.credentialStatus];
            }
            else if (this.credential.metaData.credentialStatus.length) {
                // array of entries
                baseCredential.status = this.credential.metaData.credentialStatus;
            }
        }
    }
}