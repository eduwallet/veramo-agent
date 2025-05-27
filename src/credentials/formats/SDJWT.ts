import Debug from 'debug';
const debug = Debug('issuer:sdjwt');

import { Credential } from '../Credential.js';
import { SDJwtVcInstance, SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc'
import { DisclosureFrame, Signer } from '@sd-jwt/types'
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import { getVctForCredentialType } from "#root/vct/Store";
import { VctClaimPathElement } from "#root/types/specification/vct";
import moment from 'moment';
import { getAgent } from '#root/agent';

export class SDJWT
{
    private credential:Credential;
    public constructor(credential:Credential)
    {
        this.credential = credential;
    }

    public async sign()
    {
        debug("signing SD JWT");
        const vct = getVctForCredentialType(this.credential.type!);

        let baseCredential:SdJwtVcPayload = {
            iss: this.credential.issuer!.did!.did,
            vct: vct.vct,
            iat: moment().unix()
        };
        if (this.credential.metaData.cnf) {
            baseCredential.cnf = this.credential.metaData.cnf;
        }

        // if we have a credentialSubject, convert it to claims
        if (this.credential.data) {
            Object.keys(this.credential.data).forEach((k) => {
                baseCredential[k] = this.credential.data![k];
            })
        }

        if (this.credential.metaData.expirationDate) {
            baseCredential.exp = moment(this.credential.metaData.expirationDate).unix();
        }

        // TODO: encode the baseCredential.status referring to the status list implementation
        // the spec does not define this explicitely
        const signer: Signer = async (data: string): Promise<string> => {
            return getAgent().keyManagerSign({ keyRef: this.credential.issuer!.keyRef, data })
        }

        const sdjwt = new SDJwtVcInstance({
          signer,
          signAlg: this.credential.issuer!.algorithm(),
          hasher: digest,
          saltGenerator: generateSalt,
          hashAlg: 'sha-256',
        });
    
        let disclosureFrame:DisclosureFrame<SdJwtVcPayload> = this.createDisclosureFrameFromVct(vct);
        const sdcredential = await sdjwt.issue(baseCredential, disclosureFrame, {
          header: {
            typ: 'vc+sd-jwt',
            kid: '#' + this.credential.issuer!.key!.kid
          },
        });
    
        this.credential.output = sdcredential;
    }

    private createDisclosureFrameFromVct(vct:any):DisclosureFrame<SdJwtVcPayload>
    {
        let disclosureFrame:DisclosureFrame<SdJwtVcPayload> = {};
        if (vct && vct.claims) {
            for (const claim of vct.claims) {
                if (claim.path && (claim.sd === 'allowed' || claim.sd === 'always')) {
                    disclosureFrame = this.addPathToDisclosureFrame(disclosureFrame, claim.path);
                }
            }
        }
        return disclosureFrame as DisclosureFrame<SdJwtVcPayload>;
    }

    private addPathToDisclosureFrame(disclosureFrame:DisclosureFrame<SdJwtVcPayload>, path:VctClaimPathElement[]): DisclosureFrame<SdJwtVcPayload>
    {
        if (path.length === 1) {
            if (!disclosureFrame._sd) {
                disclosureFrame._sd = [];
            }
            disclosureFrame._sd.push(path[0] as string);
        }
        else if (path.length > 1) {
            const key = path[0]!;
            if (!disclosureFrame[key]) {
                disclosureFrame[key] = {};
            }
            const remainingPath = path.slice(1);
            const frameToAdd = disclosureFrame[key] as DisclosureFrame<SdJwtVcPayload>;
            const frame = this.addPathToDisclosureFrame(frameToAdd, remainingPath);
            disclosureFrame[key] = frame as any;
        }
        return disclosureFrame;
    }
}