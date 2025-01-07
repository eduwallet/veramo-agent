import Debug from 'debug';
import { v4 } from 'uuid'
import { IEWIssuerOptsImportArgs, StatusList, StringKeyedObject } from "types";
import { IssuerMetadataV1_0_13, CredentialConfigurationSupportedV1_0_13, Alg, StateType,
  CredentialDataSupplierInput, CredentialResponse, CredentialRequestV1_0_13
 } from '@sphereon/oid4vci-common';
import { VcIssuer, VcIssuerBuilder, MemoryStates, CredentialDataSupplierResult, CredentialIssuanceInput } from '@sphereon/oid4vci-issuer';
import { Router } from "express";
import { DIDDocument, IIdentifier, IKey } from '@veramo/core';
import { getCredentialSignerCallback, getJwtVerifyCallback } from "@sphereon/ssi-sdk.oid4vci-issuer";
import { JWTVerifyOptions } from "did-jwt";
import { JsonWebKey } from 'did-resolver';
import { resolver } from 'resolver';
import { getAgent } from 'agent';
import { credentialResolver } from "credentials/credentialResolver";
import { toJwk, JwkKeyUse } from '@sphereon/ssi-sdk-ext.key-utils';
import { getCredentialConfigurationStore } from "credentials/Store";
import { getDbConnection } from "database";
import { Credential, Claims } from "database/entities/Credential";
import moment from "moment";
import { credentialDataChecker } from "credentials/credentialDataChecker";
import { jwtDecode } from 'jwt-decode'

const debug = Debug('agent:issuer');
type TKeyType = 'Ed25519' | 'Secp256k1' | 'Secp256r1' | 'X25519' | 'RSA' | 'Bls12381G1' | 'Bls12381G2'

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

// TODO: OBV3 says the following:
// > The signing algorithm MUST be "RS256" as a minimum as defined in [RFC7518]. Support for
// > other algorithms is permitted but their use limits interoperability. Later versions of
// > this specification MAY add OPTIONAL support for other algorithms. See Section 6.1 RSA Key
// > of the IMS Global Security Framework v1.1.
//
// So we must support RS256 at least, and should remove the other algorithms.
const algMapping: Record<TKeyType, Alg> = {
  Ed25519: Alg.EdDSA,
  X25519: Alg.EdDSA,
  Secp256k1: Alg.ES256,
  Secp256r1: Alg.ES256K,
  RSA: Alg.RS512,
  Bls12381G1: Alg.ES256, // incorrect
  Bls12381G2: Alg.ES256 // incorrect
}

interface IssuerSessionData extends StateType {
  state: string;
  credential?: CredentialDataSupplierResult;
  metaData?: StringKeyedObject;
  holder?:string;
  principalCredentialId?: string;
  credentialId?: string;
  uuid?: string;
  requestResponseData?:any;
}


export enum StatusListRevocationState {
  UNKNOWN = 'UNKNOWN',
  REVOKED = 'REVOKED',
  WAS_REVOKED = 'WAS_REVOKED',
  UNREVOKED = 'UNREVOKED',
  WAS_UNREVOKED = 'WAS_UNREVOKED'
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
    public sessionData:MemoryStates<IssuerSessionData>;

    public constructor(_options:IEWIssuerOptsImportArgs, _metadata: IssuerMetadataV1_0_13) {
        this.options = _options;
        this.metadata = _metadata;
        this.keyRef = '';
        this.did = null;
        this.name = _options.options.correlationId;
        this.vcIssuer = this.buildVcIssuer();
        this.sessionData = new MemoryStates<IssuerSessionData>();
    }

    public async getSessionById(id: string): Promise<IssuerSessionData> {
      var retval = await this.sessionData.get(id);
      if (!retval) {
        retval = {
          state: id,
          createdAt: +new Date()
        }
      }
      return retval;
    }

    public async storeRequestResponseData(id:string, phase:string, data:any, isJwt = false)
    {
        const session = await this.getSessionById(id);
        if (session) {
            if (!session.requestResponseData) {
                session.requestResponseData = {};
            }

            if (isJwt && typeof(data) == 'string') {
                // decode the JWT to get the payload
                data = jwtDecode(data);
            }

            session.requestResponseData[phase] = data;
        }
    }

    public async storeCredential(id:string)
    {
        const session = await this.sessionData.getAsserted(id);
        if (session && session.credential) {
            const dbConnection = await getDbConnection();
            const repo = dbConnection.getRepository(Credential);
            const credData:CredentialIssuanceInput = session.credential.credential;
            const dbCred = new Credential();
            dbCred.uuid = v4();
            dbCred.state = session.state;
            dbCred.issuanceDate = moment((credData.issuanceDate as string) || undefined).toDate();
            dbCred.claims = credData.credentialSubject as Claims;
            if (credData.expirationDate) {
                dbCred.expirationDate = moment((credData.expirationDate as string) || undefined).toDate();
            }
            else {
                dbCred.expirationDate = undefined;
            }
            dbCred.holder = session.holder || '';
            dbCred.credpid = session.principalCredentialId || '';
            dbCred.issuer = this.name;
            dbCred.credentialId = session.credentialId || '';
            if (credData.credentialStatus && typeof(credData.credentialStatus) == 'object') {
                dbCred.statuslists = credData.credentialStatus;
            }
            await repo.save(dbCred);
            session.uuid = dbCred.uuid;
        }
    }

    public async clearExpired()
    {
        // do some random state cleanup to keep memory use down
        await this.sessionData.clearExpired();
        await this.vcIssuer.cNonces.clearExpired();
        await this.vcIssuer.uris?.clearExpired();
        await this.vcIssuer.credentialOfferSessions.clearExpired();
    }

    public checkCredentialData(credentialIds:string[], credentialData: CredentialDataSupplierInput)
    {
        return credentialDataChecker(this, credentialIds[0], credentialData);
    }

    public async issueCredential(credentialRequest:CredentialRequestV1_0_13): Promise<{response:CredentialResponse, state:string}>
    {
        var stateId = '';
        const response = await this.vcIssuer.issueCredential({
            credentialRequest,
            tokenExpiresIn: 300,
            cNonceExpiresIn: 5000,
            jwtVerifyCallback: async (args: { jwt: string; kid?: string }) => {
                if (this.vcIssuer.jwtVerifyCallback) {
                    // jump through some loops to get data about the holder into our session state
                    const result = await this.vcIssuer.jwtVerifyCallback(args);
                    const holder = result.did;
                    const nonce = result.jwt.payload.nonce;
                    const cNonceState = await this.vcIssuer.cNonces.getAsserted(nonce || '')
                    stateId = cNonceState.preAuthorizedCode || cNonceState.issuerState || '';
                    var sessionState = await this.getSessionById(stateId);
                    sessionState.holder = holder;
                    await this.sessionData.set(stateId, sessionState);
                    return result;
                }
                throw new Error('no jwtVerifyCallback defined');
            }
        });
        return {
          response,
          state: stateId
        };
    }

    public async setDid()
    {
      if (typeof this.options.options.issuerOpts?.didOpts?.identifierOpts?.identifier == 'string') {
        this.did = await getAgent().didManagerGet({did: this.options.options.issuerOpts?.didOpts?.identifierOpts?.identifier});
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
            .withCredentialSignerCallback(getCredentialSignerCallback(this.options.options.issuerOpts.didOpts, { agent: getAgent() }))
            .withJWTVerifyCallback(getJwtVerifyCallback({ verifyOpts: jwtVerifyOpts }, { agent: getAgent() }))
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

        metadata.authorization_challenge_endpoint = this.options.baseUrl + '/authorization-challenge';

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

    public async listCredentials(primaryId?:string, credential?:string, issuanceDate?:string, state?:string, holder?:string)
    {
      const dbConnection = await getDbConnection();
      var qb = dbConnection.createQueryBuilder().select('c.id, c.issuer, c.state, c.holder, c.credentialId as "credentialType", c.credpid as "principalCredentialId", c."issuanceDate", c."expirationDate", c."saveDate", c."updateDate", c.claims, c.statuslists').from(Credential, 'c').where('c.id > 0');
      if (primaryId && primaryId.length) {
          qb = qb.andWhere('c.credpid=:credpid', {credpid: primaryId});
      }
      if (credential && credential.length) {
          qb = qb.andWhere('c.credentialId=:credentialId', {credentialId:credential});
      }
      if (issuanceDate && issuanceDate.length) {
          qb = qb.andWhere('c."issuanceDate" > :issuanceDate', {issuanceDate});
      }
      if (state && state.length) {
          qb = qb.andWhere('c.state=:state', {state});
      }
      if (holder && holder.length) {
          qb = qb.andWhere('c.holder=:holder', {holder});
      }

      return await qb.orderBy('c.id', 'ASC').getRawMany();
    }

    public async revokeCredential(uuid:string, doRevoke:boolean, listName?:string): Promise<StatusListRevocationState>
    {
        debug("revoking specific credential " + uuid);
        const dbConnection = await getDbConnection();
        const userRepository = dbConnection.getRepository(Credential);
        const credential = await userRepository.findOneBy({uuid});
        if (!credential) {
            debug("credential not found in database");
            throw new Error("No such credential");
        }
        if (!credential.statuslists) {
            debug("credential has no statuslists associated");
            throw new Error("No statuslist available");
        }
        // convert the if-only-one-than-not-an-array spec to an always-array-even-if-only-one implementation
        var retval:StatusListRevocationState = StatusListRevocationState.UNKNOWN;
        const statuslists = Array.isArray(credential.statuslists) ? credential.statuslists : [credential.statuslists];
        debug("looping over " + statuslists.length + " statuslists");
        for (const statlist of statuslists) {
            if (!listName || listName == statlist.id) {
                retval = this.mergeStatusListStates(retval, await this.revokeCredentialFromList(credential, statlist, doRevoke));
            }
        }
        return retval;
    }

    private mergeStatusListStates(oldState:StatusListRevocationState, newState:StatusListRevocationState)
    {
        debug("merging old state " + oldState + " with " + newState);
        // if we had no state, use the new state
        if (oldState == StatusListRevocationState.UNKNOWN) {
            oldState = newState;
        }
        // if something had changed, do not update
        if (oldState != StatusListRevocationState.REVOKED && oldState != StatusListRevocationState.UNREVOKED) {
            // this updates to REVOKED and UNREVOKED, or resets WAS_REVOKED and WAS_UNREVOKED
            oldState = newState;
        }
        debug("returning state " + oldState);
        return oldState;
    }

    private async revokeCredentialFromList(credential:Credential, statlist:StatusList, doRevoke: boolean): Promise<StatusListRevocationState>
    {
        debug("revoking credential of type " + credential.credentialId);
        const slist = this.options.statusLists![credential.credentialId];
        if (slist) {
            debug("invoking " + slist.revoke + " with " + statlist.statusListIndex + ' and request to ' + (doRevoke ? 'revoke' : 'unrevoke'));
            const returnValue:any = await fetch(slist.revoke, {
                method: 'POST',
                body: JSON.stringify({
                    list: statlist.statusListCredential,
                    index: statlist.statusListIndex,
                    state: doRevoke ? 'revoke' : 'unrevoke'
                }),
                headers: {
                    'Content-type': 'application/json',
                    'Authorization': 'Bearer ' + slist.token,
                }
            }).then((r) => r.json());
            debug("return value is " + JSON.stringify(returnValue));
            // an error in the call will cause an exception which is caught upstairs
            switch (returnValue.state) {
                case 'REVOKED': return StatusListRevocationState.REVOKED;
                case 'UNREVOKED': return StatusListRevocationState.UNREVOKED;
                case 'UNCHANGED': return doRevoke ? StatusListRevocationState.WAS_REVOKED : StatusListRevocationState.WAS_UNREVOKED;
                default: return StatusListRevocationState.UNKNOWN;
            }
        }
        else {
            // else we ignore a statuslist that is no longer configured
            debug("no status list associated with this credential type in the configuration (anymore). Ignoring request");
        }
        return StatusListRevocationState.UNKNOWN;
    }
}
