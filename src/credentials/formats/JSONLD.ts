import Debug from 'debug';
const debug = Debug('issuer:jose');

import { VCDM as VCDMType, W3CJWT } from '#root/credentials/formats/VCDMTypes';
import { Credential } from '#root/credentials/Credential';
import jsigs from 'jsonld-signatures';
import { getContextConfigurationStore } from '#root/contexts/Store';
import moment from 'moment';
import { JwsLinkedDataSignature } from '#root/crypto/JwsLinkedDataSignature';

export class JSONLD
{
    // jsigs attaches `proof` to the top-level of whatever document is passed
    // in. For the VCDM2.0 case (VCDMType) that is the credential itself; for
    // the VCDM1.1/W3CJWT envelope ({vc: ...}) the proof is intentionally
    // added as a sibling of `vc`, not nested inside it.
    public static async sign(credential:Credential, document: VCDMType|W3CJWT, date?:string)
    {
        debug("signing VCDM using JSONLD");
        date = moment(date ?? credential.metaData.issuanceDate).toISOString();

        const signedVC = await jsigs.sign(
            document,
            {
                suite: new JwsLinkedDataSignature({
                    key: credential.issuer!.key!,
                    date: date,
                    alg: credential.issuer!.algorithm(),
                }),
                purpose: new jsigs.purposes.AssertionProofPurpose(),
                documentLoader: this.documentLoader
            }
        );

        return signedVC;
    }

    // Only resolve @context documents that are explicitly registered. This is
    // security-sensitive signing code; falling back to fetching arbitrary
    // remote URLs here would let credential-type configuration trigger
    // uncontrolled outbound requests during signing.
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
        throw new Error(`JSONLD documentLoader: unresolvable context url "${url}"`);
    }
}
