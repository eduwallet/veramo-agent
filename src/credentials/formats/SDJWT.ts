import Debug from 'debug';
const debug = Debug('issuer:sdjwt');

import { Credential } from '#root/credentials/Credential';
import { SDJwtVcInstance, SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc'
import { DisclosureFrame, Signer } from '@sd-jwt/types'
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import { getVctForCredentialType } from "#root/vct/Store";
import { VctClaimPathElement } from "#root/types/specification/vct";
import { fromString } from 'uint8arrays';
import moment from 'moment';
import { Factory } from '@muisit/cryptokey';
import { VCDM } from './VCDM.js';
import { StatusListCredentialAttribute, StatusListCredentialAttributeIETF } from '#root/types/internal/statuslists';

export class SDJWT
{
    private credential:Credential;
    private baseCredential:any;
    private type:string = 'dc+sd-jwt';
    public constructor(credential:Credential, type:string = 'dc+sd-jwt')
    {
        this.credential = credential;
        this.type = type;
    }

    public async build()
    {
        if (this.type == 'dc+sd-jwt') {
            this.baseCredential = this.credential.data;
        }
        else {
            const cred = new VCDM(this.credential);
            this.baseCredential = await cred.build();
        }
    }

    public async sign()
    {
        debug("signing SD JWT");
        let vct:any = null;
        if (this.type == 'dc+sd-jwt') {
            vct = getVctForCredentialType(this.credential.type!);
        }

        const baseCredential:SdJwtVcPayload = {
            iss: this.credential.issuer!.did!.did,
            ...(vct && {vct: vct!.vct!}),
            fed: this.credential.issuer?.options.baseUrl,
            iat: moment().unix()
        };
        if (this.credential.automaticallyBindHolder && this.credential.holder) {
            // https://www.rfc-editor.org/rfc/rfc7800.html
            if (this.credential.holder.type == "kid") {
                baseCredential.cnf = {kid: this.credential.holder.data};
            }
            else if (this.credential.holder.type == "jwk") {
                baseCredential.cnf = {jwk: this.credential.holder.data};
            }
            else if (this.credential.holder.type == "x5c") {
                baseCredential.cnf = {x5c: this.credential.holder.data};
            }
            else {
                throw new Error("Cannot create confirm cnf claim for holder binding for non supported proof type " + this.credential.holder.type);
            }
        }

        // if we have a credentialSubject, convert it to claims
        if (this.baseCredential) {
            Object.keys(this.baseCredential).forEach((k) => {
                baseCredential[k] = this.baseCredential![k];
            });
        }

        if (this.credential.metaData.expirationDate) {
            baseCredential.exp = moment(this.credential.metaData.expirationDate).unix();
        }
        this.addStatusListData(baseCredential);

        const signer: Signer = async (data: string): Promise<string> => {
            return await this.credential.issuer!.key!.sign(this.credential.issuer!.algorithm(), fromString(data, 'utf-8'), 'base64url')
        }

        const sdjwt = new SDJwtVcInstance({
          signer,
          signAlg: this.credential.issuer!.algorithm(),
          hasher: digest,
          saltGenerator: generateSalt,
          hashAlg: 'sha-256',
        });
    
        const disclosureFrame:DisclosureFrame<SdJwtVcPayload> = this.createDisclosureFrameFromVct(vct);
        const sdcredential = await sdjwt.issue(baseCredential, disclosureFrame, {
          header: {
            typ: this.type,
            cty: 'vc',
            kid: '#' + Factory.getKeyReference(this.credential.issuer!.did!.did)
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

    // add the status-list data for IETF token lists.
    private addStatusListData(baseCredential:SdJwtVcPayload)
    {
        // status list data should _always_ be added by the issuer, never by passing prefabricated data.
        // Hence we can be more or less sure of the constitution of the data at this point. It should contain
        // ready to consume StatusListCredentialAttributes
        if (this.credential.metaData.credentialStatus) {
            // array of entries
            let statusses:StatusListCredentialAttribute[] = this.credential.metaData.credentialStatus;
           
            // as opposed to the JOSE implementation, we retain all the available
            // status lists and add them as entries here.
            // However, the IETF spec only allows a single status list. We take the first
            // one if there are more, so SDJWT implementations must restrict the number
            // of configured status lists
            if (statusses.length > 0) {
                // IETF specifies that the status of a JWT is embedded in the status claim
                // as a status_list entry, no matter the encoding.
                // The statuslist agent returns a ready to use return value
                baseCredential.status = {
                    // we cast here to pass the type check, but if it were a BitstringStatusList, it'd be fine
                    // this is very much use case driven, so application defined
                    status_list: statusses[0] as StatusListCredentialAttributeIETF
                };
            }
        }
    }
}