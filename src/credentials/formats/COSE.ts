import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType} from '#root/credentials/formats/VCDMTypes';
import { VCDM } from "#root/credentials/formats/VCDM";
import { Credential } from '#root/credentials/Credential';
import moment from 'moment';
import * as cbor from 'cbor2';
import { toString } from 'uint8arrays';

export class COSE
{
    private credential:Credential;
    private type:string = 'vc+jwt';

    public constructor(credential:Credential, type:string = 'vc+jwt')
    {
        this.credential = credential;
        this.type = type;
    }

    public async sign()
    {
        debug("signing VCDM using COSE");
        const vcdm = new VCDM(this.credential);
        const baseCredential = vcdm.build();
        this.credential.output = await this.packCredential(baseCredential);
    }

    private async packCredential(baseCredential:any)
    {
        // https://www.w3.org/TR/vc-jose-cose/
        // https://www.w3.org/TR/vc-jose-cose/#securing-vcs-with-cose

        // When the iat (Issued At) and/or exp (Expiration Time) JWT claims are present, they 
        // represent the issuance and expiration time of the signature, respectively.
        baseCredential.iss = moment().unix();
        if (this.credential.metaData.expirationDate) {
            // signature at least expires at the expiration date of the credential itself
            baseCredential.iat = moment(this.credential.metaData.expirationDate).unix();
        }

        // Implementers SHOULD avoid setting JWT claims to values that conflict with the values of
        // verifiable credential properties when a claim and property pair refer to the same
        // conceptual entity, especially with pairs such as iss and issuer, jti and id, and
        // sub and credentialSubject.id.
        baseCredential.iss = this.credential.issuer!.did!.did;
        if (baseCredential.id) {
            baseCredential.jti = baseCredential.id;
        }
        if (baseCredential.credentialSubject.id) {
            baseCredential.sub = baseCredential.credentialSubject.id;
        }

        // "The unsecured verifiable credential is the unencoded COSE_Sign1 payload"
        const cborPayload = cbor.encode(baseCredential);

        const protectedHeader = {
            alg: this.credential.issuer!.algorithm()
        };
        const protectedHeaderBytes = cbor.encode(protectedHeader);

        // The typ (16) header parameter, as described in COSE "typ" (type) Header Parameter, SHOULD be application/vc+cose.
        // The content type (3) header parameter SHOULD be application/vc
        const unprotectedHeader = {
            typ: 'application/vc+cose',
            cty: 'application/vc',
            kid: this.credential.issuer!.did!.did + '#' + this.credential.issuer!.keyRef,
            iss: this.credential.issuer!.did!.did
        };

        const sigStructure = [
            'Signature1',
            protectedHeaderBytes,
            Buffer.alloc(0),
            cborPayload
        ];
        const sigStructureBytes = cbor.encode(sigStructure);

        const signature = await this.credential.issuer!.signData(sigStructureBytes);

        // cose sign1 is a special case with only 1 signature (RFC8152 section 4.2)
        const coseSign1 = [
            protectedHeaderBytes,
            unprotectedHeader,
            cborPayload,
            Buffer.from(signature!)
        ];
        const finalCoseObject = cbor.encode(coseSign1);
        return toString(finalCoseObject, 'base64url');
    }
}