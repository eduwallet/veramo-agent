import Debug from 'debug';
const debug = Debug('issuer:issuer');

import moment from "moment";
import { Router } from "express";
import { StatusList, StatusListIETF, StatusListW3C } from "#root/types/internal/statuslists";
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
import { SessionStateManager } from '#root/utils/SessionStateManager';
import { StringKeyedObject } from '#root/types/index';
import { retrieveASServerKey } from '#root/issuer/lib/retrieveASServerKey';
import { createUniqueId } from '#root/utils/createUniqueId';
import { CredentialFactory } from '#root/credentials/CredentialFactory';
import { CryptoKey, Factory } from '@muisit/cryptokey';
import { Session } from '#root/packages/datastore/entities/Session';
import { NonceManager } from '#root/utils/NonceManager';

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
    public nonceStates:NonceManager;
    public serverKeys:StringKeyedObject;
    public usesNonces:boolean;

    public constructor(_options:IssuerConfiguration, _metadata: MetadataConfiguration) {
        this.options = _options;
        this.metadata = _metadata;
        this.key = null;
        this.keyRef = _options.key ?? '';
        this.name = _options.name;
        this.sessionData = new SessionStateManager(this.name);
        this.nonceStates = new NonceManager(this.name);
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

    public async getSessionById(id: string = ''): Promise<Session> {
        return await this.sessionData.get(id, (el:Session) => { el.uuid = id; return el; });
    }
    public async getSessionByState(id: string = ''): Promise<Session|null> {
        return await this.sessionData.getByState(id);
    }
    public async storeSession(state:Session)
    {
        await this.sessionData.set(state);
    }
    public async removeSession(state:Session)
    {
        await this.sessionData.clear(state.uuid);
    }

    public async storeRequestResponseData(id:string, phase:string, data:any, isJwt = false)
    {
        const session = await this.getSessionById(id);
        if (session) {
            if (!session.data.requestResponseData) {
                session.data.requestResponseData = {};
            }

            if (isJwt && typeof(data) == 'string') {
                // decode the JWT to get the payload
                data = JWT.fromToken(data);
            }
            session.data.requestResponseData[phase] = data;
            await this.storeSession(session);
        }
    }

    public async storeCredential(session:Session, credential:Credential)
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(CredentialEntity);
        const dbCred = new CredentialEntity();
        dbCred.uuid = createUniqueId();
        dbCred.state = session.state;
        dbCred.issuanceDate = moment((credential.metaData.issuanceDate as string) || undefined).toDate();
        dbCred.claims = credential.data as StringKeyedObject;
        if (credential.metaData.expirationDate) {
            dbCred.expirationDate = moment((credential.metaData.expirationDate as string) || undefined).toDate();
        }
        else {
            dbCred.expirationDate = undefined;
        }
        dbCred.holder = session.data.holder || '';
        dbCred.credpid = session.data.principalCredentialId || '';
        dbCred.issuer = this.name;
        dbCred.metadata = this.getCredentialConfiguration(session.data.credentialId) as StringKeyedObject;
        dbCred.credentialId = session.data.credentialId || '';
        if (credential.metaData.credentialStatus) {
            if (!Array.isArray(credential.metaData.credentialStatus)) {
                dbCred.statuslists = [credential.metaData.credentialStatus];
            }
            else {
                dbCred.statuslists = credential.metaData.credentialStatus;
            }
        }
        await repo.save(dbCred);
        session.data.uuid = dbCred.uuid;
    }

    public async clearExpired()
    {
        await this.sessionData.clearAll();
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
        if (this.usesNonces) {
            metadata.nonce_endpoint = this.options.baseUrl + '/nonce';
        }

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
      var qb = dbConnection.createQueryBuilder().select('c.uuid, c.id, c.issuer, c.state, c.holder, c.credentialId as "credentialType", c.credpid as "principalCredentialId", c."issuanceDate", c."expirationDate", c."saveDate", c."updateDate", c.claims, c.statuslists').from(CredentialEntity, 'c').where('c.id > 0');
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

        var retval:StatusListRevocationState = StatusListRevocationState.UNKNOWN;
        // we should have store this as an array, but you never know with these specs...
        const statuslists = Array.isArray(credential.statuslists) ? credential.statuslists : [credential.statuslists];

        debug("looping over " + statuslists.length + " statuslists");
        for (const statlist of statuslists) {
            if (!listName || statlist.credentialStatus?.id?.startsWith(listName)) {
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
        let slists = this.options.statusLists![credential.credentialId];
        if (slists) {
            // make sure it is an array
            if (!Array.isArray(slists)) slists=[slists];
            for (const slist of slists) {
                // if we actually have a revoke interface, revoke it
                // TODO: perhaps create other interfaces/services for suspend/message/etc
                if (slist.url == statlist.uri && slist.revoke) {
                    debug("invoking " + slist.revoke + " with " + statlist + ' and request to ' + (doRevoke ? 'revoke' : 'unrevoke'));
                    try {
                        const listuri = statlist.type == 'statuslist+jwt' ? (statlist.credentialStatus as StatusListIETF).uri : (statlist.credentialStatus as StatusListW3C).statusListCredential
                        const returnValue:any = await fetch(slist.revoke, {
                            method: 'POST',
                            body: JSON.stringify({
                                list: listuri,
                                index: statlist.index,
                                status: doRevoke ? 'revoke' : 'unrevoke'
                            }),
                            headers: {
                                'Content-type': 'application/json',
                                'Authorization': 'Bearer ' + slist.token,
                            }
                        }).then((r) => r.json());
                        debug("return value is " + JSON.stringify(returnValue));

                        // an error in the call will cause an exception which is caught upstairs
                        switch (returnValue.status) {
                            case 'REVOKED': return StatusListRevocationState.REVOKED;
                            case 'UNREVOKED': return StatusListRevocationState.UNREVOKED;
                            case 'UNCHANGED': return doRevoke ? StatusListRevocationState.WAS_REVOKED : StatusListRevocationState.WAS_UNREVOKED;
                            default: return StatusListRevocationState.UNKNOWN;
                        }
                    }
                    catch (e) {
                        debug("caught exception ", e, " on revocation");
                    }
                }
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
