import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType} from './VCDMTypes';
import { VCDM } from "./VCDM";
import { Credential } from '../Credential';
import jsigs from 'jsonld-signatures';
import { Issuer } from '#root/issuer/Issuer';
import { getContextConfigurationStore } from '#root/contexts/Store';
import * as jsonld from 'jsonld';

export class JSONLD
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
        debug("signing VCDM using JSONLD");
        const vcdm = new VCDM(this.credential);
        const baseCredential = vcdm.build();
        this.credential.output = await this.packCredential(baseCredential);
    }

    private async packCredential(baseCredential:VCDMType)
    {
        const signedVC = await jsigs.sign(
            baseCredential,
            {
                suite: new CallbackSignature(this.credential.issuer!),
                purpose: new jsigs.purposes.AssertionProofPurpose(),
                documentLoader: this.documentLoader
            }
        );
        console.error(signedVC);
        // this adjusts the original object, but this is intentional. This allows us to use JSONLD
        // in combination with JOSE to create an embedded and external signature
        baseCredential.proof = {
            type: 'JsonWebSignature2020',
            created: new Date().toISOString(),
            proofPurpose: 'assertionMethod',
            verificationMethod: this.credential.issuer!.did!.did + '#' + this.credential.issuer!.keyRef,
            jws: signedVC.proof['https://w3id.org/security#jws'], // or 'proofValue' or 'signatureValue' depending on the format
        };
        return baseCredential;
    }

    private documentLoader(url:string):any {
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

    constructor(issuer:Issuer) {
        super({
          type: 'MyCustomSignature',
          LDKeyClass: null
        });
    
        this.issuer = issuer; // custom callback
    }
    
    async sign({ data, proof }: {data:Uint8Array, proof:any}) {
        const signature = await this.issuer.signData(data);
        proof.jws = Buffer.from(signature).toString('base64url');
        return proof;
    }

    async getVerificationMethod() {
        return this.issuer.did!.did + '#' + this.issuer.keyRef;
    }
}