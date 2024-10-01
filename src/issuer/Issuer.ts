import { IEWIssuerOptsImportArgs } from "types";
import { IssuerMetadataV1_0_13, CredentialConfigurationSupportedV1_0_13, Alg } from '@sphereon/oid4vci-common';
import { VcIssuer, VcIssuerBuilder } from '@sphereon/oid4vci-issuer';
import { Router } from "express";
import { DIDDocument, IIdentifier, IKey, TKeyType } from '@veramo/core';
import { getCredentialSignerCallback, getJwtVerifyCallback } from "@sphereon/ssi-sdk.oid4vci-issuer";
import { JWTVerifyOptions } from "did-jwt";
import { JsonWebKey } from 'did-resolver';
import { resolver } from '../plugins';
import { context } from '../agent';
import { credentialResolver } from "credentials/credentialResolver";
import { toJwk, JwkKeyUse } from '@sphereon/ssi-sdk-ext.key-utils';
import { getCredentialConfigurationStore } from "credentials/Store";

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
  X25519: Alg.EdDSA,
  Secp256k1: Alg.ES256,
  Secp256r1: Alg.ES256K,
  RSA: Alg.RS512,
  Bls12381G1: Alg.ES256, // incorrect
  Bls12381G2: Alg.ES256 // incorrect
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
        builder.withIssuerMetadata(this.generateMetadata())
            .withCredentialSignerCallback(getCredentialSignerCallback(this.options.options.issuerOpts.didOpts, context))
            .withJWTVerifyCallback(getJwtVerifyCallback({ verifyOpts: jwtVerifyOpts }, context))
            .withInMemoryCNonceState()
            .withInMemoryCredentialOfferState()
            .withCredentialDataSupplier(credentialResolver(this))
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
        var keys:IKey[] = (this.did?.keys ?? []).filter((key) => key.kid == this.keyRef);
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

    public hasCredentialConfiguration(names:string[]):boolean {
      // the list of names should contain only one name, but for the sake of argument/specification...
      // the VerifiableCredential type should have been filtered out
      for (const id of names) {
          // just in case we forgot to filter out the VerifiableCredential type
          if (id != 'VerifiableCredential') {
              if (!this.metadata.credential_configurations_supported[id]) {
                  return false;
              }
          }
      }
      return true;
    }

    public getCredentialConfiguration(id:string): CredentialConfigurationSupportedV1_0_13|null {
        if (this.hasCredentialConfiguration([id])) {
            return this.decorateCredentialConfiguration(id);
        }
        return null;
    }

    public generateMetadata() {
        var metadata = this.metadata;
        var credentials:Record<string, CredentialConfigurationSupportedV1_0_13> = {};
        for (const id of Object.keys(this.metadata.credential_configurations_supported)) {
            const credentialConfiguration = this.decorateCredentialConfiguration(id);
            credentials[id] = credentialConfiguration;
        }
        metadata.credential_configurations_supported = credentials;
        metadata.credential_issuer = this.options.baseUrl;
        metadata.credential_endpoint = this.options.baseUrl + '/credentials';
        return metadata;
    }

    private decorateCredentialConfiguration(id:string):CredentialConfigurationSupportedV1_0_13 {
        const store = getCredentialConfigurationStore();
        if (this.metadata.credential_configurations_supported[id]) {
            return Object.assign({}, store[id] ?? {}, this.metadata.credential_configurations_supported[id]) as CredentialConfigurationSupportedV1_0_13;
        }
        else if(store[id]) {
          return store[id] as CredentialConfigurationSupportedV1_0_13;
        }
        return {} as CredentialConfigurationSupportedV1_0_13;
    }
}
