import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType} from './VCDMTypes';
import { Credential } from '../Credential';
import jsigs from 'jsonld-signatures';
import { getContextConfigurationStore } from '#root/contexts/Store';
import * as jsonld from 'jsonld';
import moment from 'moment';
import { JwsLinkedDataSignature } from '#root/crypto/JwsLinkedDataSignature';

export class JSONLD
{
    public static async sign(credential:Credential, output: VCDMType, date?:string)
    {
        debug("signing VCDM using JSONLD");
        date = moment(date).toISOString();

        const signedVC = await jsigs.sign(
            output,
            {
                suite: new JwsLinkedDataSignature({
                    key: credential.issuer!.key, 
                    date: date,
                    alg: credential.issuer!.algorithm(),
                }),
                purpose: new jsigs.purposes.AssertionProofPurpose(),
                documentLoader: this.documentLoader,
                expansionMap: false
            }
        );

        return signedVC;
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
