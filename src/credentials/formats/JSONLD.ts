import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType} from './VCDMTypes';
import { Credential } from '../Credential';
import jsigs from 'jsonld-signatures';
import { Issuer } from '#root/issuer/Issuer';
import { getContextConfigurationStore } from '#root/contexts/Store';
import * as jsonld from 'jsonld';
import { JWT } from '#root/jwt/JWT';
import { toString } from 'uint8arrays';
import moment from 'moment';

export class JSONLD
{
    public static async sign(credential:Credential, output: VCDMType, date?:string)
    {
        debug("signing VCDM using JSONLD");
        date = moment(date).toISOString();

        const signedVC = await jsigs.sign(
            output,
            {
                suite: new CallbackSignature(credential.issuer!, date),
                purpose: new jsigs.purposes.AssertionProofPurpose(),
                documentLoader: this.documentLoader,
                expansionMap: false
            }
        );

        // this adjusts the original object, but this is intentional. This allows us to use JSONLD
        // in combination with JOSE to create an embedded and external signature
        output.proof = {
            type: 'JsonWebSignature2020',
            created: new Date().toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: credential.issuer!.did!.did + '#' + credential.issuer!.keyRef,
            jws: signedVC.proof['https://w3id.org/security#jws']
        };
        return output;
    }

    private static documentLoader(url:string):any {
        const contextStore = getContextConfigurationStore();
        const obj = contextStore.resolve(url);
        if (obj) {
            return {
                contextUrl: null,
                documentUrl: url,
                document: obj
            };
        }
        return jsonld.documentLoaders.node(url);
    }
}

class CallbackSignature extends jsigs.suites.LinkedDataSignature
{
    private issuer:Issuer;

    constructor(issuer:Issuer, date:string) {
        super({
          type: 'JsonWebSignature2020',
          LDKeyClass: null
        });
    
        this.issuer = issuer; // custom callback
        this.date = date;
    }
    
    async sign({ verifyData, document, proof }: {verifyData:Uint8Array, document:any, proof:any}) {
        const jwt = new JWT();
        jwt.header = {
            alg: this.issuer.algorithm(),
            b64: true,
            crit: ["b64"],
        };
        jwt.payloadPart = toString(verifyData, 'base64url');
        await jwt.sign(async (data:Uint8Array) => this.issuer.signData(data));
        proof.jws = jwt.headerPart + '..' + jwt.signaturePart;
        return proof;
    }

    async getVerificationMethod() {
        return {
            id: this.issuer.did!.did + '#0',
            type: 'JsonWebKey2020',
            controller: this.issuer.did!.did,
            publicKeyJwk: await this.issuer.exportJWK()
        };
    }
}