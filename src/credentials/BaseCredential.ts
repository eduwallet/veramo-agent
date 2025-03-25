import { SDJwtVcInstance, SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc'
import { DisclosureFrame, Signer } from '@sd-jwt/types'
import { digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import { Issuer } from "issuer/Issuer";
import { getAgent } from 'agent';
import moment from "moment";
import { CredentialPayload, CredentialStatusReference, CredentialSubject } from "@veramo/core";
import { getVctForCredentialType } from "vct/Store";
import { CredentialProofData, CredentialResult } from "types/internal";
import { VctClaimPathElement } from "types/specification/vct";
import { StringKeyedObject } from "types";

export interface ClaimList {
    [x:string]: any
}

export class BaseCredential
{
    public issuer:Issuer;
    public credentialId:string;

    protected automaticallyBindHolder = true;

    public constructor(issuer:Issuer, credentialId:string)
    {
        this.issuer = issuer;
        this.credentialId = credentialId;
    }

    protected claimPresent(claim:string, type:string, claims:ClaimList)
    {
        if (typeof(claims[claim]) != 'undefined' && claims[claim] !== null) {
            // do not allow empty strings as proper string value
            if (typeof(claims[claim]) == 'string' && claims[claim] === '') {
                return false;
            }
            if (type != 'any' && typeof(claims[claim]) != type) {
                return false;
            }
            return true;
        }
        return false;
    }

    private handleExpirationDate(result:CredentialResult, date:string):CredentialResult
    {
        if (date && date.length) {
            (result.credential as CredentialPayload).expirationDate = moment().add(parseInt(date), 's').toISOString();
        }
        return result;
    }

    public async handleAttributes(proofData: CredentialProofData, type:string, mainCredentialIdentifierClaim:string, result:CredentialResult): Promise<CredentialResult>
    {
        const { session, credentialDataSet, keys } = proofData;
        const { data } = credentialDataSet;

        if (data._exp) {
            result = this.handleExpirationDate(result, data._exp);
        }
        if (data._ttl) {
            result = this.handleExpirationDate(result, data._ttl);
        }
        if (session && session.metaData && session.metaData.expiration) {
            result = this.handleExpirationDate(result, session.metaData.expiration);
        }
        if (this.automaticallyBindHolder) {
            result = this.bindHolder(result, keys);
        }

        const credential = result.credential as CredentialPayload;
    
        const enableLists = !session.metaData || (typeof session.metaData.enableStatusLists === 'undefined') || (session.metaData.enableStatusLists === true);
        if (this.issuer.options.statusLists && enableLists) {
            const statusses:CredentialStatusReference[] = [];
            if (this.issuer.options.statusLists[type]) {
                const slist = this.issuer.options.statusLists[type];
                const listData = await fetch(slist.url, {
                    method: 'POST',
                    body: JSON.stringify({ expirationDate: credential.expirationDate }),
                    headers: {
                        'Content-type': 'application/json',
                        'Authorization': 'Bearer ' + slist.token,
                        }
                }).then((r) => r.json()).catch((e) => { console.log(e); return null;});

                if (!listData || !listData.url) {
                    throw new Error("Unable to contact status server");
                }

                const entry:CredentialStatusReference = {
                    id: listData.id,
                    type: 'StatusList2021Entry', // should be: 'BitstringStatusListEntry'
                    statusPurpose: listData.purpose,
                    statusListIndex: listData.index,
                    statusListCredential: listData.url
                };
                statusses.push(entry);
            }

            if (statusses.length > 0) {
                if (statusses.length > 1) {
                    // cast so we can assign the array as the spec indicates
                    credential.credentialStatus = (statusses as unknown) as CredentialStatusReference;
                }
                else {
                    credential.credentialStatus = statusses[0];
                }
            }
        }
    
        session.credential = result;
        session.principalCredentialId = (credential.credentialSubject!)[mainCredentialIdentifierClaim] || '';
        session.credentialType = type;
        this.issuer.storeSession(session);

        if (result.format == 'vc+sd-jwt' || result.format == 'dc+sd-jwt') {
            result.signCallback = (opts:any) => { return this.signSDJwt(opts);}
        }

        return result;
    }

    private async signSDJwt(credential:CredentialPayload): Promise<string>
    {
        let baseCredential = (credential as unknown) as SdJwtVcPayload;
        // type must be set and it must have 2 entries at least, one of which is VerifiableCredential
        let type = credential.type?.filter((i:string)=> i != 'VerifiableCredential')[0];
        // if we have a credentialSubject, convert it to a claims attribute
        if (baseCredential.credentialSubject) {
            baseCredential.claims = baseCredential.credentialSubject;
            delete baseCredential.credentialSubject;
        }

        baseCredential.issuer = this.issuer.metadata.credential_issuer;
        baseCredential.iss = this.issuer.metadata.credential_issuer;
        if (credential.expirationDate) {
            baseCredential.exp = moment(credential.expirationDate).unix();
        }
        const vct = getVctForCredentialType(type!);
        baseCredential.vct = vct!.vct;
        baseCredential.iat = moment().unix();
        // TODO: encode the baseCredential.status referring to the status list implementation
        // the spec does not define this explicitely

        const signer: Signer = async (data: string): Promise<string> => {
            return getAgent().keyManagerSign({ keyRef: this.issuer.keyRef, data })
        }

        const sdjwt = new SDJwtVcInstance({
          signer,
          signAlg: this.issuer.algorithm(),
          hasher: digest,
          saltGenerator: generateSalt,
          hashAlg: 'sha-256',
        });
    
        let disclosureFrame:DisclosureFrame<SdJwtVcPayload> = this.createDisclosureFrameFromVct(type!);

        const sdcredential = await sdjwt.issue(baseCredential, disclosureFrame, {
          header: {
            typ: 'vc+sd-jwt',
            ...(this.issuer.key!.kid !== undefined && { kid: this.issuer.key!.kid })
          },
        })
    
        console.log('returning sdcredential', sdcredential);
        return sdcredential;
    }

    private createDisclosureFrameFromVct(credentialType:string):DisclosureFrame<SdJwtVcPayload>
    {
        let disclosureFrame:DisclosureFrame<SdJwtVcPayload> = {};
        const vct = getVctForCredentialType(credentialType);
        if (vct && vct.claims) {
            for (const claim of vct.claims) {
                if (claim.path && (claim.sd === 'allowed' || claim.sd === 'always')) {
                    disclosureFrame = this.addPathToDisclosureFrame(disclosureFrame, claim.path);
                }
            }
        }
        return {"claims": disclosureFrame };
    }

    private addPathToDisclosureFrame(disclosureFrame:DisclosureFrame<SdJwtVcPayload>, path:VctClaimPathElement[])
    {
        if (path.length === 1) {
            if (!disclosureFrame._sd) {
                disclosureFrame._sd = [];
            }
            disclosureFrame._sd.push(path[0] as string);
        }
        else if (path.length > 1) {
            if (!disclosureFrame[path[0] as string]) {
                disclosureFrame[path[0] as string] = {};
            }
            const remainingPath = path.slice(1);
            disclosureFrame[path[0] as string] = this.addPathToDisclosureFrame(disclosureFrame[path[0] as string] as DisclosureFrame<SdJwtVcPayload>, remainingPath);
        }
        return disclosureFrame;
    }

    private bindHolder(result:CredentialResult, keys:StringKeyedObject)
    {
        // Bind credential to the provided proof of possession
        if (['dc+sd-jwt', 'vc+sd-jwt'].includes(result.format!)) {
            // https://www.rfc-editor.org/rfc/rfc7800.html
            if (!result.credential.cnf) {
                if (keys.kid) {
                    result.credential.cnf = {kid: keys.kid};
                }
                else if(keys.jwk) {
                    result.credential.cnf = {jwk: keys.jwk};
                }
            }
        }
        else if (keys.did) {
            // the credentialSubject can be a single object, or an array of objects. 
            // If it is an array, it supposedly refers to several subjects and we cannot
            // simply guess which is the actual holder, nor if all refer to the holder
            // Hence we only do automatic holder binding if the credentialSubject is not a list
            const credential = result.credential as CredentialPayload;
            if (!Array.isArray(credential) && !(credential.credentialSubject as CredentialSubject).id) {
                (credential.credentialSubject as CredentialSubject).id = keys.did;
            }
        }
        return result;
    }
}