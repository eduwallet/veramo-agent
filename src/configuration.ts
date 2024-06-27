import { TAgent, IAgentContext } from '@veramo/core'

import {OID4VCIRestAPI} from "@sphereon/ssi-sdk.oid4vci-issuer-rest-api";
import {getCredentialDataSupplier} from "./utils/oid4vciCredentialSuppliers";
import {ExpressBuilder, ExpressCorsConfigurer, StaticBearerAuth} from "@sphereon/ssi-express-support";
import {RemoteServerApiServer} from "@sphereon/ssi-sdk.remote-server-rest-api";
import {pdManagerMethods} from '@sphereon/ssi-sdk.pd-manager'
import {IPresentationDefinition} from "@sphereon/pex";
import {ISIOPv2RPRestAPIOpts, SIOPv2RPApiServer} from "@sphereon/ssi-sdk.siopv2-oid4vp-rp-rest-api";

import { TAgentTypes, oid4vpRP, oid4vciStore, resolver } from './plugins';
import {getDefaultDID, getDefaultKid, getDefaultOID4VPRPOptions, getIdentifier, getOrCreateDIDs} from "./utils";
import { addDefaultsToOpts, getDefaultOID4VCIIssuerOptions, issuerPersistToInstanceOpts, toImportIssuerOptions} from "./utils/oid4vci";
import {INTERNAL_HOSTNAME_OR_IP, INTERNAL_PORT, IS_OID4VCI_ENABLED, IS_OID4VP_ENABLED, oid4vciInstanceOpts, OID4VP_DEFINITIONS, syncDefinitionsOpts} from "./environment";

export var expressSupport:any;

export async function configure(agent: TAgent<TAgentTypes>, context: IAgentContext<TAgentTypes>) {
    await getOrCreateDIDs().catch(e => console.log(e))

    const defaultDID = await getDefaultDID()
    const defaultKid = await getDefaultKid({did: defaultDID})
    if (!defaultDID || !defaultKid || !(await getIdentifier(defaultDID))) {
        console.log('TODO create identifier and write config')
        // create Identifier
    }
    const oid4vpOpts = IS_OID4VP_ENABLED ? await getDefaultOID4VPRPOptions({did: defaultDID, resolver}) : undefined
    if (oid4vpOpts && oid4vpRP) {
        oid4vpRP.setDefaultOpts(oid4vpOpts, context)
    }
    
    StaticBearerAuth.init('bearer-auth').addUser({name: 'demo', id: 'demo', token: 'demo'}).connectPassport()
    
    expressSupport = IS_OID4VCI_ENABLED || IS_OID4VP_ENABLED ?
        ExpressBuilder.fromServerOpts({
            hostname: INTERNAL_HOSTNAME_OR_IP,
            port: INTERNAL_PORT,
            basePath: process.env.EXTERNAL_HOSTNAME ? new URL(process.env.EXTERNAL_HOSTNAME).toString() : undefined
        })
            .withCorsConfigurer(new ExpressCorsConfigurer({}).allowOrigin('*').allowCredentials(true))
            .withPassportAuth(true)
            .withMorganLogging()
            .build({startListening: false}) : undefined
    
    
    if (IS_OID4VP_ENABLED) {
        if (!expressSupport) {
            throw Error('Express support needs to be configured when exposing OID4VP')
        }
        const opts: ISIOPv2RPRestAPIOpts = {
            enableFeatures: ['siop', 'rp-status'],
            endpointOpts: {
                basePath: process.env.OID4VP_AGENT_BASE_PATH ?? '',
                globalAuth: {
                    authentication: {
                        enabled: false,
                        strategy: 'bearer-auth'
                    },
                    secureSiopEndpoints: false
                },
                webappCreateAuthRequest: {
                    webappBaseURI: process.env.OID4VP_WEBAPP_BASE_URI ?? `http://localhost:${INTERNAL_PORT}`,
                    siopBaseURI: process.env.OID4VP_AGENT_BASE_URI ?? `http://localhost:${INTERNAL_PORT}`,
                },
                webappAuthStatus: {
                    // webappBaseURI: process.env.OID4VP_WEBAPP_BASE_URI ?? `http://localhost:${INTERNAL_PORT}`,
                },
                webappDeleteAuthRequest: {
                    // webappBaseURI: process.env.OID4VP_WEBAPP_BASE_URI ?? `http://localhost:${INTERNAL_PORT}`,
                },
                siopGetAuthRequest: {
                    // siopBaseURI: process.env.OID4VP_AGENT_BASE_URI ?? `http://localhost:${INTERNAL_PORT}`,
                },
                siopVerifyAuthResponse: {
                    // siopBaseURI: process.env.OID4VP_AGENT_BASE_URI ?? `http://localhost:${INTERNAL_PORT}`,
                }
            }
        }
        new SIOPv2RPApiServer({agent, expressSupport, opts})
        console.log('[OID4VP] SIOPv2 and OID4VP started: ' + process.env.OID4VP_AGENT_BASE_URI ?? `http://localhost:${INTERNAL_PORT}}`)
    }
    
    if (IS_OID4VCI_ENABLED) {
        if (!expressSupport) {
            throw Error('Express support needs to be configured when exposing OID4VP')
        }
    
        if (oid4vciStore) {
            const defaultOpts = await getDefaultOID4VCIIssuerOptions({resolver})
            const importIssuerPersistArgs = toImportIssuerOptions()
            for (const opt of importIssuerPersistArgs) {
                await addDefaultsToOpts(opt.issuerOpts);
            }
            // const importIssuerOpts = await Promise.all(importIssuerPersistArgs.map(async opt => issuerPersistToInstanceOpts(opt)))
            oid4vciStore.defaultOpts = defaultOpts
            oid4vciStore.importIssuerOpts(importIssuerPersistArgs)
        }
    
        oid4vciInstanceOpts.asArray.map(async opts => issuerPersistToInstanceOpts(opts).then(async instanceOpt => {
                    const oid4vciRest = await OID4VCIRestAPI.init({
                            context,
                            expressSupport,
                            issuerInstanceArgs: {
                                ...instanceOpt
                            },
                            /*opts: {
                                // baseUrl: '',
                                endpointOpts: {
                                    tokenEndpointOpts: {
                                        accessTokenSignerCallback:
                                    }
                                }
    
                                },*/
                            credentialDataSupplier: getCredentialDataSupplier(instanceOpt.credentialIssuer)
                        }
                    )
                    console.log(`[OID4VCI] Started at ${expressSupport.hostname}:${expressSupport.port}, with issuer ${oid4vciRest.issuer.issuerMetadata.credential_issuer}`)
                }
            )
        )
    }
    
    
    if (expressSupport) {
        new RemoteServerApiServer({
            agent,
            expressSupport,
            opts: {
                exposedMethods: [...pdManagerMethods],
                endpointOpts: {
                    globalAuth: {
                        authentication: {
                            enabled: false,
                        },
                    },
                },
            },
        })
    }
    
    // Import presentation definitions from disk.
    const definitionsToImport: Array<IPresentationDefinition> = syncDefinitionsOpts.asArray.filter(definition => {
        const {id, name} = definition ?? {};
        if (definition && (OID4VP_DEFINITIONS.length === 0 || OID4VP_DEFINITIONS.includes(id) || (name && OID4VP_DEFINITIONS.includes(name)))) {
            console.log(`[OID4VP] Enabling Presentation Definition with name '${name ?? '<none>'}' and id '${id}'`);
            return true
        }
        return false
    })
    
    if (definitionsToImport.length > 0) {
        agent.siopImportDefinitions({
            definitions: definitionsToImport,
            versionControlMode: 'AutoIncrementMajor' // This is the default, but just to indicate here it exists
        })
    }
    

}