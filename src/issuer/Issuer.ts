import Debug from 'debug';
import { v4 } from 'uuid'
import { StatusList } from "types/specification/statuslists";
import { Router } from "express";
import { CredentialPayload, DIDDocument, DIDResolutionOptions, IIdentifier, IKey } from '@veramo/core';
import { createJWT, decodeJWT, verifyJWT } from "did-jwt";
import { JsonWebKey } from 'did-resolver';
import { getAgent } from 'agent';
import { toJwk, JwkKeyUse } from '@sphereon/ssi-sdk-ext.key-utils';
import { getFirstKeyWithRelation } from '@sphereon/ssi-sdk-ext.did-utils'
import { getCredentialConfigurationStore } from "credentials/Store";
import { getDbConnection } from "database";
import { Credential, Claims } from "database/entities/Credential";
import moment from "moment";
import { credentialDataChecker } from "credentials/credentialDataChecker";
import { jwtDecode } from 'jwt-decode'
import { getContextConfigurationStore } from 'contexts/Store';
import { getIdentifier, getIdentifierByAlias } from 'utils/did';
import { getVctForCredentialType } from 'vct/Store';
import { IssuerConfiguration } from 'types/internal';
import { SessionState, SessionStateManager } from 'utils/SessionStateManager';
import { bytesToBase64 } from '@veramo/utils';
import { JWT } from 'types/specification/jwt';
import { ClaimsList, CredentialConfiguration, CredentialConfigurationJwtVC, CredentialConfigurations, CredentialConfigurationSdJwt, Metadata } from 'types/specification/metadata';
import { StatusListRevocationState } from 'types/api';
import { ExtendableCredentialConfiguration, MetadataConfiguration } from 'types/api/metadata';
import { Alg, algMapping, keyMapping } from 'crypto/index';

const debug = Debug('agent:issuer');

export class Issuer
{
    public name:string;
    public metadata:MetadataConfiguration;
    public options:IssuerConfiguration;
    public did?:IIdentifier;
    public key:IKey|null;
    public keyRef:string;
    public router:Router|undefined;
    public sessionData:SessionStateManager;
    public authorizationState:Map<string, string>;
    public nonceStates:Map<string, string>;

    public constructor(_options:IssuerConfiguration, _metadata: MetadataConfiguration) {
        this.options = _options;
        this.metadata = _metadata;
        this.key = null;
        this.keyRef = '';
        this.name = _options.name;
        this.sessionData = new SessionStateManager();
        this.authorizationState = new Map<string,string>();
        this.nonceStates = new Map<string, string>();
    }

    public algorithm():string
    {
        return algMapping[this.key!.type];
    }

    public async setDid()
    {
        this.did = await getIdentifier(this.options.did);
        if (!this.did) {
            this.did = await getIdentifierByAlias(this.options.did);
        }

        if (!this.did) {
            throw new Error('Missing issuer did configuration');
        }

        this.key = await getFirstKeyWithRelation({ identifier: this.did!, vmRelationship: 'assertionMethod', offlineWhenNoDIDRegistered: true }, { agent: getAgent() })
        this.keyRef = this.key!.kid;
    }

    public signData(data: string | Uint8Array)
    {
        let dataString, encoding: 'base64' | undefined
        const keyRef = this.keyRef;
        if (!keyRef) {
            throw Error('Cannot sign access tokens without a key ref')
        }
        if (typeof data === 'string') {
            dataString = data
            encoding = undefined
        }
        else {
            dataString = bytesToBase64(data)
            encoding = 'base64'
        }
        return getAgent().keyManagerSign({ keyRef, data: dataString, encoding });
    }

    public async signToken(jwt: JWT) {
        if (!this.did?.did) {
            throw Error('No issuer configured for access tokens')
        }
        const signer = (data:string | Uint8Array) => this.signData(data);
        const signOptions = {
            signer,
            issuer: this.did?.did
        }
        const result = await createJWT(jwt.payload, signOptions, { ...jwt.header, typ: 'JWT' })
        return result
    }

    public async verifyToken(jwt:string)
    {
        const result = await verifyJWT(jwt, {
            audience: this.metadata.credential_issuer,
            resolver: {
                resolve: async (didUrl:string, options?:DIDResolutionOptions) => {
                    return await getAgent().resolveDid({ didUrl, options })
                }
            }
        });

        if (!result.verified) {
            return null;
        }

        const decoded = decodeJWT(jwt);
        const alg = decoded.header.alg;
        const kid = decoded.header.kid;
        const did = (kid ?? '').split('#')[0]
        return {
            decoded,
            didResolution: result.didResolutionResult,
            alg,
            kid,
            did
        };   
    }

    public getSessionById(id: string = ''): SessionState {
        return this.sessionData.get(id, (el:SessionState) => { el.state = id; return el; });
    }
    public storeSession(state:SessionState)
    {
        this.sessionData.set(state);
    }
    public removeSession(state:SessionState)
    {
        if (this.authorizationState.has(state.issuerState)) {
            this.authorizationState.delete(state.issuerState);
        }
        if (this.authorizationState.has(state.preAuthorizedCode)) {
            this.authorizationState.delete(state.preAuthorizedCode);
        }
        this.sessionData.clear(state.id);
    }

    public async storeRequestResponseData(id:string, phase:string, data:any, isJwt = false)
    {
        const session = this.getSessionById(id);
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

    public async storeCredential(session:SessionState, credential:CredentialPayload)
    {
        if (session && credential && typeof(credential) !== 'string') {
            const dbConnection = await getDbConnection();
            const repo = dbConnection.getRepository(Credential);
            const dbCred = new Credential();
            dbCred.uuid = v4();
            dbCred.state = session.state;
            dbCred.issuanceDate = moment((credential.issuanceDate as string) || undefined).toDate();
            dbCred.claims = credential.credentialSubject as Claims;
            if (credential.expirationDate) {
                dbCred.expirationDate = moment((credential.expirationDate as string) || undefined).toDate();
            }
            else {
                dbCred.expirationDate = undefined;
            }
            dbCred.holder = session.holder || '';
            dbCred.credpid = session.principalCredentialId || '';
            dbCred.issuer = this.name;
            dbCred.credentialId = session.credentialId || '';
            if (credential.credentialStatus && typeof(credential.credentialStatus) == 'object') {
                dbCred.statuslists = credential.credentialStatus;
            }
            await repo.save(dbCred);
            session.uuid = dbCred.uuid;
        }
    }

    public async clearExpired()
    {
        // do some random state cleanup to keep memory use down
        this.sessionData.clearAll();
        //await this.vcIssuer.cNonces.clearExpired();
        //await this.vcIssuer.uris?.clearExpired();
    }

    public checkCredentialData(credentialIds:string[], claims: any)
    {
        return credentialDataChecker(this, credentialIds[0], claims);
    }

    public getDidDoc ():DIDDocument {
        const allKeys = this.did!.keys.map((key:IKey) => ({
            id: this.did!.did + '#' + key.kid,
            type: keyMapping[key.type],
            controller: this.did!.did,
            publicKeyJwk: toJwk(key.publicKeyHex, key.type, { use: JwkKeyUse.Signature, key: key}) as JsonWebKey,
        }));
    
        const services = this.did!.keys.map((key:IKey) => ({
            id: this.did!.did + '#' + key.kid,
            type: "OID4VCI",
            serviceEndpoint: this.metadata.credential_issuer
        }));
    
        // ed25519 keys can also be converted to x25519 for key agreement
        const keyAgreementKeyIds = allKeys
            .filter((key:IKey) => ['Ed25519VerificationKey2018', 'X25519KeyAgreementKey2019'].includes(key.type))
            .map((key:IKey) => key.id)
        const signingKeyIds = allKeys
            .filter((key:IKey) => key.type !== 'X25519KeyAgreementKey2019')
            .map((key:IKey) => key.id)
        
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
        var keys:IKey[] = (this.did?.keys ?? []).filter((key:IKey) => key.kid == this.keyRef);
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

    public hasCredentialConfiguration(name:string):boolean|ExtendableCredentialConfiguration {
        if (!name || typeof(name) != 'string' || name == '') {
            return false;
        }

        for (const credentialId of Object.keys(this.metadata.credential_configurations_supported)) {
            if (credentialId === name) {
                return this.metadata.credential_configurations_supported[credentialId];
            }
            if (this.metadata.credential_configurations_supported[credentialId].vct === name) {
                return this.metadata.credential_configurations_supported[credentialId];
            }
            if (this.metadata.credential_configurations_supported[credentialId].credential_definition
                && this.metadata.credential_configurations_supported[credentialId].credential_definition.type.includes(name)) {
                return this.metadata.credential_configurations_supported[credentialId];
            }

        }
        return false;
    }

    public getCredentialConfiguration(id:string): CredentialConfiguration|null {
        const credential = this.hasCredentialConfiguration(id);
        if (credential !== false) {
            return this.decorateCredentialConfiguration(id, credential as ExtendableCredentialConfiguration);
        }
        return null;
    }

    public getCredentialContext(id:string): string[]
    {
        if (this.hasCredentialConfiguration(id)) {
            // return the @context setting on the metadata specification, assuming this is applicable
            // to all credentials defined in the set
            if (this.metadata['@context'] && this.metadata['@context'].length) {
                const contextStore = getContextConfigurationStore();
                return this.metadata['@context'].map((item) => {
                    if (contextStore[item]) {
                        return contextStore[item].fullPath!;
                    }
                    return null;
                }).filter((i) => i !== null) as string[];
            }
        }
        return [];
    }

    public generateMetadata() {
        const metadata:Metadata = Object.assign({}, this.metadata) as Metadata;
        var credentials:CredentialConfigurations = {};
        for (const id of Object.keys(this.metadata.credential_configurations_supported)) {
            const credentialConfiguration = this.decorateCredentialConfiguration(id);
            credentials[id] = credentialConfiguration;
        }
        metadata.credential_configurations_supported = credentials;
        metadata.credential_identifiers_supported = true;
        metadata.credential_issuer = this.options.baseUrl;
        metadata.credential_endpoint = this.options.baseUrl + '/credentials';

        return metadata;
    }

    /**
     * 
     * @param credentialId : string uniquely identifying this credential configuration in the metadata
     * @param credential : credential configuration in vc_jwt format (with credential_definition)
     * @returns : credential metadata in vc+sd-jwt format
     * 
     * We do some name and type mangling here to be able to convert one object type (JwtVC) to
     * another (SD-JWT) and test/delete the attributes that are missing or need to be converted
     */
    private convertToSdCredential(credentialId:string, credential:CredentialConfigurationJwtVC): CredentialConfiguration
    {
        const vct = getVctForCredentialType(credentialId);
        const sdjwt = (credential as unknown) as CredentialConfigurationSdJwt;
        if (vct !== null) {
            sdjwt.vct = vct.vct!;
            if (!sdjwt.claims && credential.credential_definition.credentialSubject) {
                const subjects = credential.credential_definition.credentialSubject;
                if (subjects) {
                    sdjwt.claims = subjects as ClaimsList;
                }
            }
            if (credential.credential_definition) {
                delete (sdjwt as any).credential_definition;
            }
        }
        return sdjwt as CredentialConfiguration;
    }

    /**
     * 
     * @param credentialId: string uniquely identifying this credential configuration in the metadata
     * @param configuration: an ExtendableCredentialConfiguration for this id
     * @returns credential metadata
     * 
     * Decorate the credential metadata as specified with the issuer with the general metadata specified
     * for this credential. 
     * If required, convert this from vc_jwt to vc+sw-jwt configuration.
     */
    private decorateCredentialConfiguration(credentialId:string, configuration?:ExtendableCredentialConfiguration):CredentialConfiguration {
        const store = getCredentialConfigurationStore();
        let overriddenConfiguration:ExtendableCredentialConfiguration;
        if (!configuration) {
            overriddenConfiguration = this.metadata?.credential_configurations_supported[credentialId] ?? {}
        }
        else {
            overriddenConfiguration = configuration;
        }

        // allow the override configuration to specify which credential id it is explicitely overriding
        if (overriddenConfiguration.extends) {
            credentialId = overriddenConfiguration.extends as string;
        }

        var decoratedCredential:CredentialConfiguration = Object.assign(
            {},
            store[credentialId] ?? {},
            overriddenConfiguration) as CredentialConfiguration;

        // remove extension mechanism from ExtendableCredentialConfiguration
        if ((decoratedCredential as ExtendableCredentialConfiguration).extends) {
            delete (decoratedCredential as ExtendableCredentialConfiguration).extends;
        }

        if (decoratedCredential.format == 'vc+sd-jwt') {
            decoratedCredential = this.convertToSdCredential(credentialId, decoratedCredential as CredentialConfigurationJwtVC);
        }

        return decoratedCredential as CredentialConfiguration;
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

    public usesAuthorisedCodeFlow()
    {
        return this.metadata.authorization_servers && this.metadata.authorization_servers.length;
    }
}
