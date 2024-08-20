import { IEWIssuerOptsImportArgs } from "types";
import { IssuerMetadataV1_0_13, Alg } from '@sphereon/oid4vci-common';
import { VcIssuer, VcIssuerBuilder } from '@sphereon/oid4vci-issuer';
import { Router } from "express";
import { DIDDocument, IIdentifier, IKey, TKeyType } from '@veramo/core';
import { getCredentialSignerCallback, getJwtVerifyCallback } from "@sphereon/ssi-sdk.oid4vci-issuer";
import { JWTVerifyOptions } from "did-jwt";
import { JsonWebKey } from 'did-resolver';
import { resolver } from '../plugins';
import { context } from '../agent';
import { getCredentialDataSupplier } from "@utils/oid4vciCredentialSuppliers";
import { toJwk, JwkKeyUse } from '@sphereon/ssi-sdk-ext.key-utils';

// mapping key types to key output types in the DIDDocument
const keyMapping: Record<TKeyType, string> = {
  Secp256k1: 'EcdsaSecp256k1VerificationKey2019',
  Secp256r1: 'EcdsaSecp256r1VerificationKey2019',
  // we need JsonWebKey2020 output
  Ed25519: 'JsonWebKey2020', //'Ed25519VerificationKey2018', 
  X25519: 'X25519KeyAgreementKey2019',
  Bls12381G1: 'Bls12381G1Key2020',
  Bls12381G2: 'Bls12381G2Key2020',
  RSA: 'RsaVerificationKey2018'
}

const algMapping: Record<TKeyType, Alg> = {
  Ed25519: Alg.EdDSA,
  Secp256k1: Alg.ES256,
  Secp256r1: Alg.ES256K
}

export class Issuer
{
    public name:string;
    public metadata:IssuerMetadataV1_0_13;
    public options:IEWIssuerOptsImportArgs;
    public did:IIdentifier|null;
    public keyRef:string;
    public router:Router|undefined;
    public vcIssuer:VcIssuer<DIDDocument>;

    public constructor(_options:IEWIssuerOptsImportArgs, _metadata: IssuerMetadataV1_0_13) {
        this.options = _options;
        this.metadata = _metadata;
        this.keyRef = '';
        this.did = null;
        this.name = _options.options.correlationId;
        this.vcIssuer = this.buildVcIssuer();
    }

    public async setDid()
    {
      if (typeof this.options.options.issuerOpts?.didOpts?.identifierOpts?.identifier == 'string') {
        this.did = await context?.agent.didManagerGet({did: this.options.options.issuerOpts?.didOpts?.identifierOpts?.identifier});
      }
      else {
        this.did = this.options.options.issuerOpts?.didOpts?.identifierOpts?.identifier;
      }
    }

    private buildVcIssuer() {
        const builder = new VcIssuerBuilder<DIDDocument>()
        if (!resolver) {
          throw Error('A Resolver is necessary to verify DID JWTs')
        }
        const jwtVerifyOpts: JWTVerifyOptions = {
          resolver,
          audience: this.metadata.credential_issuer,
        }
        builder.withIssuerMetadata(this.metadata)
            .withCredentialSignerCallback(getCredentialSignerCallback(this.options.options.issuerOpts.didOpts, context))
            .withJWTVerifyCallback(getJwtVerifyCallback({ verifyOpts: jwtVerifyOpts }, context))
            .withInMemoryCNonceState()
            .withInMemoryCredentialOfferState()
            .withCredentialDataSupplier(getCredentialDataSupplier(this))
            .withInMemoryCredentialOfferURIState();
      
        return builder.build();
    }  

    public getDidDoc ():DIDDocument {
      const allKeys = this.did!.keys.map((key) => ({
        id: this.did!.did + '#' + key.kid,
        type: keyMapping[key.type],
        controller: this.did!.did,
        publicKeyJwk: toJwk(key.publicKeyHex, key.type, { use: JwkKeyUse.Signature, key: key}) as JsonWebKey,
      }));
    
      const services = this.did!.keys.map((key) => ({
        id: this.did!.did + '#' + key.kid,
        type: "OID4VCI",
        serviceEndpoint: this.metadata.credential_issuer
      }));
    
      // ed25519 keys can also be converted to x25519 for key agreement
      const keyAgreementKeyIds = allKeys
        .filter((key) => ['Ed25519VerificationKey2018', 'X25519KeyAgreementKey2019'].includes(key.type))
        .map((key) => key.id)
      const signingKeyIds = allKeys
        .filter((key) => key.type !== 'X25519KeyAgreementKey2019')
        .map((key) => key.id)
    
      const didDoc:DIDDocument = {
        '@context': 'https://w3id.org/did/v1',
        id: this.did!.did,
        verificationMethod: allKeys,
        authentication: signingKeyIds,
        assertionMethod: signingKeyIds,
        keyAgreement: keyAgreementKeyIds,
        service: [...services, ...(this.did?.services || [])],
      }
    
      return didDoc;
    }

    public signingAlg():Alg {
        var keys:IKey[] = (this.did?.keys ?? []).filter((key) => key.id == this.keyRef);
        if (keys.length == 0 && this.did!.keys) {
            keys = this.did!.keys;
        }
        if (keys.length) {
            const key = keys[0];
            if (algMapping[key.type]) {
                return algMapping[key.type];
            }
        }
        return Alg.ES256;
    }
}
