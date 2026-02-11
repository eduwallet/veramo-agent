import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType, W3CJWT as W3CType} from '#root/credentials/formats/VCDMTypes';
import { VCDM } from "#root/credentials/formats/VCDM";
import { W3C } from "#root/credentials/formats/W3C"
import { JSONLD } from '#root/credentials/formats/JSONLD';
import { Credential } from '#root/credentials/Credential';
import moment from 'moment';
import { JWT } from '#root/jwt/JWT';
import { Factory } from '@muisit/cryptokey';

export class JOSE
{
    private credential:Credential;
    private type:string = 'vc+jwt';
    private date:string;

    public constructor(credential:Credential, type:string = 'vc+jwt', date?:string)
    {
        this.credential = credential;
        this.type = type;
        this.date = moment(date).toISOString();
    }

    public async sign()
    {
        debug("signing VCDM using JOSE");
        let vcdm:any;
        if (this.type == 'vc+jwt') {
            vcdm = new VCDM(this.credential);
        }
        else {
            vcdm = new W3C(this.credential);
        }
        let baseCredential = vcdm.build();

        // apply filters to add proofs
        if (this.type == 'jwt_vc_json-ld') {
            baseCredential = JSONLD.sign(this.credential, baseCredential);
        }

        // pack and sign the credential
        this.credential.output = await this.packCredential(baseCredential);
    }

    private async packCredential(baseCredential:VCDMType|W3CType)
    {
        // https://www.w3.org/TR/vc-jose-cose/
        // https://www.w3.org/TR/vc-jose-cose/#securing-with-jose
        // "The unsecured verifiable credential is the payload"
        const jwt = new JWT();
        jwt.payload = Object.assign({}, baseCredential);

        // typ and cty are only defined for JSON-LD. The JOSE definition does not mention
        // these headers, but they are not explicitely disallowed either
        jwt.header = {
            alg: this.credential.issuer!.algorithm(),
            kid: '#' + Factory.getKeyReference(this.credential.issuer!.did!.did),
            // VCDM 1.1: if typ is present, it must be JWT
            typ: this.type == 'vc+jwt' ? this.type : 'JWT',
            cty: 'vc'
        };

        // It is RECOMMENDED to use the IANA JSON Web Token Claims registry and the IANA JSON
        // Web Signature and Encryption Header Parameters registry to identify any claims and
        // header parameters that might be confused with members defined by [VC-DATA-MODEL-2.0].
        // These include but are not limited to: iss, kid, alg, iat, exp, and cnf. 
        jwt.header.iss = this.credential.issuer!.did!.did;

        // When the iat (Issued At) and/or exp (Expiration Time) JWT claims are present, they 
        // represent the issuance and expiration time of the signature, respectively.
        jwt.payload.iat = moment(this.date).unix();
        // if nbf is present, it MUST represent the issuance date (VCDM 1.1)
        jwt.payload.nbf = jwt.payload.iat; // Sphereon requires this claim
        if (this.credential.metaData.expirationDate) {
            // signature at least expires at the expiration date of the credential itself
            jwt.payload.exp = moment(this.credential.metaData.expirationDate).unix();
        }

        // Implementers SHOULD avoid setting JWT claims to values that conflict with the values of
        // verifiable credential properties when a claim and property pair refer to the same
        // conceptual entity, especially with pairs such as iss and issuer, jti and id, and
        // sub and credentialSubject.id.
        if ((baseCredential as VCDMType).id) {
            jwt.payload.jti = (baseCredential as VCDMType).id;
        }
        if ((baseCredential as VCDMType).credentialSubject?.id) {
            jwt.payload.sub = (baseCredential as VCDMType).credentialSubject.id;
        }
        if ((baseCredential as W3CType).vc?.credentialSubject?.id) {
            jwt.payload.sub = (baseCredential as W3CType).vc.credentialSubject.id;
        }

        this.addStatusListData(jwt);
        return await this.credential.issuer!.signToken(jwt);
    }

    private addStatusListData(jwt:JWT)
    {
        if (this.credential.metaData.credentialStatus) {
            let statusses:any = [];

            if (this.credential.metaData.credentialStatus.type) {
                statusses = [this.credential.metaData.credentialStatus];
            }
            else {
                statusses = this.credential.metaData.credentialStatus;
            }
            
            statusses = statusses.filter((el:any) => el.type == 'statuslist+jwt');
            if (statusses.length > 0) {
                // IETF specifies that the status of a JWT is embedded in the status claim
                // as a status_list entry, no matter the encoding.
                // The statuslist agent returns a ready to use return value
                jwt.payload.status = {
                    status_list: statusses[0].credentialStatus
                };
            }
        }
    }
}