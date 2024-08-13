import Debug from 'debug'
import { TAgent } from '@veramo/core'

import {ExpressBuilder, ExpressCorsConfigurer, StaticBearerAuth} from "@sphereon/ssi-express-support";

import { TAgentTypes, importIssuerOpts } from '../plugins';
import { Issuer } from "./issuer";
import { dumpExpressRoutes } from '../utils/dumpExpressRoutes';

const debug = Debug(`eduwallet:server`)

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS ?? '0.0.0.0'
const BASEURL = process.env.BASEURL ?? 'https://agent.dev.eduwallet.nl'
const BEARER_TOKEN = process.env.BEARER_TOKEN ?? 'eduwallet'

StaticBearerAuth.init('bearer-auth').addUser({name: 'admin', id: 'admin', token: BEARER_TOKEN}).connectPassport()
    
const expressSupport = ExpressBuilder.fromServerOpts({
        hostname: LISTEN_ADDRESS,
        port: PORT,
        basePath: new URL(BASEURL).toString()
    })
        .withCorsConfigurer(new ExpressCorsConfigurer({}).allowOrigin('*').allowCredentials(true))
        .withPassportAuth(true)
        .withMorganLogging()
        .build({startListening: false});

export const initialiseServer = async (agent:TAgent<TAgentTypes>) => {
    debug('creating routes for each issuer instance');
    const storeId = await agent.oid4vciStoreDefaultStoreId();
    const nameSpace = await agent.oid4vciStoreDefaultNamespace();

    /*
     * ImportIssuerOpts is the list of JSON data under conf/issuer
     * It's type definition is in types/index.ts as IEWIssuerOptsImportArgs
     * 
     * It contains an options field of type IIssuerOptsPersistArgs/Ioid4vciStorePersistArgs, which
     * contains the persisted issuer options in the OIDVCIStore. This makes it hard to extend the
     * data that is stored in the persisted database...
     */
    for (const issuerOptions of importIssuerOpts) {
        debug("initializing rest api using ", issuerOptions);
        const metadata = await agent.oid4vciStoreGetMetadata({correlationId: issuerOptions.options.correlationId, storeId: storeId, namespace: nameSpace});

        var tokenEndpointOpts = {
            //enabled: true,
            tokenEndpointDisabled: false,
            // override the access-token-issuer, by default set to the credential-issuer
            // accessTokenIssuer:
            preAuthorizedCodeExpirationDuration: 300000, // max time between creation of the offer and the token request in ms
            interval: 300000, // interval between requesting new credential tokens, in seconds
            tokenExpiresIn: 300, // time of life of the access token, in seconds
            tokenPath: '/token'
        };

        if (metadata?.authorization_server || metadata?.authorization_servers) {
            tokenEndpointOpts.tokenEndpointDisabled = true;
        }

        await Issuer.init({
            context: {agent},
            expressSupport,
            issuerOptions: issuerOptions,
            opts: {
                baseUrl: issuerOptions.baseUrl,
                tokenPath: '/token',
                credentialOfferPath: '/get-credential-offer',
                endpointOpts: {
                    createCredentialOfferOpts: {
                        enabled: issuerOptions.enableCreateCredentials,
                        path: '/api/create-offer'
                    },
                    getCredentialOfferOpts: {
                        enabled: true,
                        path: '/get-credential-offer/:id'
                    },
                    getStatusOpts: {
                        enabled: true,
                        path: '/api/check-offer'
                    },
                    tokenEndpointOpts
                }
            }
        });
    }

    debug("starting express server");
    expressSupport.start();

    dumpExpressRoutes(expressSupport.express);
}
