import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { CompactSdJwtVc, ICredentialStatus, AdditionalClaims } from '@sphereon/ssi-types';
import { SDJwtVcInstance, SdJwtVcPayload } from '@sd-jwt/sd-jwt-vc'
import { DisclosureFrame, JwtPayload, KbVerifier, PresentationFrame, Signer, Verifier } from '@sd-jwt/types'
import { Issuer } from "issuer/Issuer";
import { getAgent } from 'agent';
import moment from "moment";
import { ES256, digest, generateSalt } from '@sd-jwt/crypto-nodejs';
import { CredentialSubject } from "@veramo/core";
import { getVctForCredentialType } from "vct/Store";

export interface ClaimList {
    [x:string]: any
}

export class BaseCredential
{
    public issuer:Issuer;
    public credentialId:string;

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

    private handleExpirationDate(result:CredentialDataSupplierResult, date:string):CredentialDataSupplierResult
    {
        if (date && date.length) {
            result.credential.expirationDate = moment().add(parseInt(date), 's').toISOString();
        }
        return result;
    }

    public async handleAttributes(args: CredentialDataSupplierArgs, type:string, principalCredentialId:string, result:CredentialDataSupplierResult): Promise<CredentialDataSupplierResult>
    {
        var session = await this.issuer.getSessionById(args.issuerState || args.preAuthorizedCode || '');        

        if (args.credentialDataSupplierInput._exp) {
            result = this.handleExpirationDate(result, args.credentialDataSupplierInput._exp);
        }
        if (args.credentialDataSupplierInput._ttl) {
            result = this.handleExpirationDate(result, args.credentialDataSupplierInput._ttl);
        }
        if (session && session.metaData && session.metaData.expiration) {
            result = this.handleExpirationDate(result, session.metaData.expiration);
        }
    
        const enableLists = !session.metaData || (typeof session.metaData.enableStatusLists === 'undefined') || (session.metaData.enableStatusLists === true);
        if (this.issuer.options.statusLists && enableLists) {
            const statusses:ICredentialStatus[] = [];
            if (this.issuer.options.statusLists[type]) {
                const slist = this.issuer.options.statusLists[type];
                const listData = await fetch(slist.url, {
                    method: 'POST',
                    body: JSON.stringify({ expirationDate: result.credential.expirationDate }),
                    headers: {
                        'Content-type': 'application/json',
                        'Authorization': 'Bearer ' + slist.token,
                        }
                }).then((r) => r.json()).catch((e) => { console.log(e); return null;});

                if (!listData || !listData.url) {
                    throw new Error("Unable to contact status server");
                }

                const entry:ICredentialStatus = {
                    id: listData.id,
                    type: 'StatusList2021Entry', // should be: 'BitstringStatusListEntry'
                    statusPurpose: listData.purpose,
                    statusListIndex: listData.index,
                    statusListCredential: listData.url
                } as ICredentialStatus; // we need the cast because ICredentialStatus does not define the purpose, etc.
                statusses.push(entry);
            }

            if (statusses.length > 0) {
                if (statusses.length > 1) {
                    // we need the cast because ICredentialStatus does not allow an array of statusses (yet)
                    result.credential.credentialStatus = (statusses as unknown) as ICredentialStatus;
                }
                else {
                    result.credential.credentialStatus = statusses[0];
                }
            }
        }
    
        session.credential = result;
        session.principalCredentialId = (result.credential.credentialSubject as AdditionalClaims)[principalCredentialId] || '';
        session.credentialType = type;
        this.issuer.sessionData.set(session.state, session);

        if (result.format == 'vc+sd-jwt') {
            result.signCallback = (opts) => { return this.signSDJwt(opts);}
        }

        return result;
    }

    private async signSDJwt(opts:any): Promise<string>
    {
        let baseCredential = opts.credential;
        // type must be set and it must have 2 entries at least, one of which is VerifiableCredential
        let type = opts.credential.type.filter((i:string)=> i!='VerifiableCredential')[0];
        // if we have a credentialSubject, convert it to a claims attribute
        if (baseCredential.credentialSubject) {
            baseCredential.claims = baseCredential.credentialSubject;
            delete baseCredential.credentialSubject;
        }

        baseCredential.issuer = this.issuer.metadata.metadata.issuer;
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
    
        let disclosureFrame:DisclosureFrame<CredentialSubject> = this.createDisclosureFrameFromVct(type);

        const credential = await sdjwt.issue(baseCredential, disclosureFrame, {
          header: {
            ...(this.issuer.key!.kid !== undefined && { kid: this.issuer.key!.kid })
          },
        })
    
        return credential;
    }

    private createDisclosureFrameFromVct(credentialType:string):DisclosureFrame<CredentialSubject>
    {
        let disclosureFrame:DisclosureFrame<CredentialSubject> = {};
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

    private addPathToDisclosureFrame(disclosureFrame:DisclosureFrame<CredentialSubject>, path:string[])
    {
        if (path.length === 1) {
            if (!disclosureFrame._sd) {
                disclosureFrame._sd = [];
            }
            disclosureFrame._sd.push(path[0]);
        }
        else if (path.length > 1) {
            if (!disclosureFrame[path[0]]) {
                disclosureFrame[path[0]] = {};
            }
            const remainingPath = path.slice(1);
            disclosureFrame[path[0]] = this.addPathToDisclosureFrame(disclosureFrame[path[0]] as DisclosureFrame<CredentialSubject>, remainingPath);
        }
        return disclosureFrame;
    }
}