import Debug from 'debug';
const debug = Debug('issuer:issuer');

import moment from "moment";
import { Router } from "express";
import { StatusList } from "#root/types/specification/statuslists";
import { StatusListRevocationState } from '#root/types/api';
import { IssuerConfiguration } from '#root/types/internal';
import { JWT } from '#root/jwt/JWT';
import { ExtendableCredentialConfiguration, MetadataConfiguration } from '#root/types/api/metadata';
import { ClaimsList, CredentialConfiguration, CredentialConfigurationJwtVC, CredentialConfigurations, CredentialConfigurationSdJwt, Metadata } from '#root/types/specification/metadata';
import { getCredentialConfigurationStore } from "#root/credentials/Store";
import { getDbConnection } from "#root/database/databaseService";
import { Credential as CredentialEntity, Identifier as IdentifierEntity, PrivateKey as PrivateKeyEntity} from "#root/packages/datastore/index";
import { getContextConfigurationStore } from '#root/contexts/Store';
import { Credential } from "#root/credentials/Credential";
import { getVctForCredentialType } from '#root/vct/Store';
import { SessionState, SessionStateManager } from '#root/utils/SessionStateManager';
import { StringKeyedObject } from '#root/types/index';
import { retrieveASServerKey } from '#root/issuer/lib/retrieveASServerKey';
import { createUniqueId } from '#root/utils/createUniqueId';
import { CredentialFactory } from '#root/credentials/CredentialFactory';
import { CryptoKey, Factory } from '@muisit/cryptokey';

export class Issuer
{
    public name:string;
    public metadata:MetadataConfiguration;
    public options:IssuerConfiguration;
    public did:IdentifierEntity|null = null;
    public key:CryptoKey|null;
    public keyRef:string;
    public router:Router|undefined;
    public sessionData:SessionStateManager;
    public authorizationState:Map<string, string>;
    public nonceStates:Map<string, string>;
    public serverKeys:StringKeyedObject;
    public usesNonces:boolean;

    public constructor(_options:IssuerConfiguration, _metadata: MetadataConfiguration) {
        this.options = _options;
        this.metadata = _metadata;
        this.key = null;
        this.keyRef = _options.key ?? '';
        this.name = _options.name;
        this.sessionData = new SessionStateManager();
        this.authorizationState = new Map<string,string>();
        this.nonceStates = new Map<string, string>();
        this.serverKeys = {};
        this.usesNonces = _options.usesNonces ?? true;
    }

    public algorithm():string
    {
        return this.key?.algorithms()[0] || 'EdDSA';
    }

    public async setDid()
    {
        const dbConnection = await getDbConnection();
        const ids = dbConnection.getRepository(IdentifierEntity);
        this.did = await ids.createQueryBuilder('identifier')
            .innerJoinAndSelect("identifier.keys", "key")
            .where('did=:did', {did: this.options.did})
            .orWhere('alias=:alias', {alias: this.options.did})
            .getOne();
        
        if (!this.did) {
            throw new Error('Missing issuer did configuration');
        }
        const dbKey = this.did.keys[0];
        if (this.keyRef == '') {
            this.keyRef = dbKey.kid;
        }

        const pkeys = dbConnection.getRepository(PrivateKeyEntity);
        const pkey = await pkeys.findOneBy({alias:dbKey.kid});

        this.key = await Factory.createFromType(dbKey.type, pkey?.privateKeyHex);
    }

    public async retrieveASServerKeys()
    {
        if (this.metadata.authorization_servers) {
            for(const as of this.metadata.authorization_servers) {
                const keys = await retrieveASServerKey(as);
                if (keys !== null && keys.length) {
                    for (const key of keys) {
                        this.serverKeys[key.kid] = key;
                    }
                }
            }
        }
    }

    public async signData(data: Uint8Array)
    {
        return await this.key?.sign(this.algorithm(), data, 'base64url');
    }

    public async signToken(jwt: JWT) {
        if (!this.did?.did) {
            throw Error('No issuer configured for access tokens')
        }
        jwt.payload.iss = this.did!.did;
        jwt.header.alg = this.algorithm();
        await jwt.sign(this.key!);
        return jwt.token;
    }

    public async verifyToken(token:string)
    {
        const jwt = JWT.fromToken(token);
        const verified = await jwt.verify(this.key!);
        if (!verified) {
            return null;
        }

        const alg = jwt.header.alg;
        const kid = jwt.header.kid;
        const did = (kid ?? '').split('#')[0]
        return {
            jwt,
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
                data = JWT.fromToken(data);
            }
            session.requestResponseData[phase] = data;
        }
    }

    public async storeCredential(session:SessionState, credential:any)
    {
        if (session && credential && typeof(credential) !== 'string') {
            const dbConnection = await getDbConnection();
            const repo = dbConnection.getRepository(CredentialEntity);
            const dbCred = new CredentialEntity();
            dbCred.uuid = createUniqueId();
            dbCred.state = session.state;
            dbCred.issuanceDate = moment((credential.issuanceDate as string) || undefined).toDate();
            dbCred.claims = credential.credentialSubject as StringKeyedObject;
            if (credential.expirationDate) {
                dbCred.expirationDate = moment((credential.expirationDate as string) || undefined).toDate();
            }
            else {
                dbCred.expirationDate = undefined;
            }
            dbCred.holder = session.holder || '';
            dbCred.credpid = session.principalCredentialId || '';
            dbCred.issuer = this.name;
            dbCred.metadata = this.getCredentialConfiguration(session.credentialId) as StringKeyedObject;
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

    public checkCredentialData(type:string, claims: any)
    {
        const credential = new Credential();
        credential.issuer = this;
        credential.type = type;
        credential.data = claims;
        return CredentialFactory.check(credential);
    }

    public async getDidDoc () {
        return await Factory.toDIDDocument(this.key!, this.did?.did, [
            {
                "id": this.did!.did + '#oid4vci',
                "type": "OID4VCI",
                "serviceEndpoint": this.options.baseUrl
            }
        ], "JsonWebKey2020"); // Sphereon requires the deprecated JsonWebKey2020 verification-method
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

    public getCredentialConfiguration(id:string, decorate:boolean = true): CredentialConfiguration|null {
        let credential:any = this.hasCredentialConfiguration(id);
        if (credential !== false) {
            if (decorate) {
                credential = this.decorateCredentialConfiguration(id, credential as ExtendableCredentialConfiguration);
            }
            return credential;
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
                return this.metadata['@context'].map((item:string) => {
                    const ctx = contextStore.get(item);
                    if (ctx) {
                        return ctx.fullPath!;
                    }
                    return null;
                }).filter((i:string | null) => i !== null) as string[];
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
        // vc+jwt is not a valid OpenID4VCI format
        else if (decoratedCredential.format == 'vc+jwt') {
            decoratedCredential.format = 'jwt_vc_json';
        }

        return decoratedCredential as CredentialConfiguration;
    }

    public async listCredentials(primaryId?:string, credential?:string, issuanceDate?:string, state?:string, holder?:string)
    {
      const dbConnection = await getDbConnection();
      var qb = dbConnection.createQueryBuilder().select('c.id, c.issuer, c.state, c.holder, c.credentialId as "credentialType", c.credpid as "principalCredentialId", c."issuanceDate", c."expirationDate", c."saveDate", c."updateDate", c.claims, c.statuslists').from(CredentialEntity, 'c').where('c.id > 0');
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
        const repo = dbConnection.getRepository(CredentialEntity);
        const credential = await repo.findOneBy({uuid});
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

    private async revokeCredentialFromList(credential:CredentialEntity, statlist:StatusList, doRevoke: boolean): Promise<StatusListRevocationState>
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

    public async exportJWK()
    {
        return this.key!.toJWK();
    }
}
