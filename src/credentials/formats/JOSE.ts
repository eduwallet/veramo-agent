import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType} from './VCDMTypes';
import { VCDM } from "./VCDM";
import { W3C } from "./W3C"
import { JSONLD } from './JSONLD';
import { Credential } from '../Credential';
import moment from 'moment';
import { JWT } from '#root/jwt/JWT';

export class JOSE
{
    private credential:Credential;
    private type:string = 'vc+jwt';
    private date:string;

    public constructor(credential:Credential, type:string = 'vc+jwt', date?:strimg)
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

    private async packCredential(baseCredential:VCDMType)
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
            kid: this.credential.issuer!.did!.did + '#' + this.credential.issuer!.keyRef,
            typ: this.type,
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
        if (this.credential.metaData.expirationDate) {
            // signature at least expires at the expiration date of the credential itself
            jwt.payload.exp = moment(this.credential.metaData.expirationDate).unix();
        }

        // Implementers SHOULD avoid setting JWT claims to values that conflict with the values of
        // verifiable credential properties when a claim and property pair refer to the same
        // conceptual entity, especially with pairs such as iss and issuer, jti and id, and
        // sub and credentialSubject.id.
        if (baseCredential.id) {
            jwt.payload.jti = baseCredential.id;
        }
        if (baseCredential.credentialSubject?.id) {
            jwt.payload.sub = baseCredential.credentialSubject.id;
        }
        if (baseCredential.vc?.credentialSubject?.id) {
            jwt.payload.sub = baseCredential.vc.credentialSubject.id;
        }

        return await this.credential.issuer!.signToken(jwt);
    }
}