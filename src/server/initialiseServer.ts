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

    for (const issuerOptions of importIssuerOpts) {
        debug("initializing rest api using ", issuerOptions);
        await Issuer.init({
            context: {agent},
            expressSupport,
            issuerOptions: issuerOptions.options,
            opts: {
                baseUrl: issuerOptions.baseUrl,
                endpointOpts: {
                    createCredentialOfferOpts: {
                        enabled: issuerOptions.enableCreateCredentials,
                        path: '/api/create-offer'
                    },
                    getCredentialOfferOpts: {
                        enabled: true,
                        path: '/api/get-offer/:id'
                    },
                    getStatusOpts: {
                        enabled: true,
                        path: '/api/check-offer'
                    },
                    tokenEndpointOpts: {
                        //enabled: true,
                        tokenEndpointDisabled: false,
                        // override the access-token-issuer, by default set to the credential-issuer
                        // accessTokenIssuer:
                        preAuthorizedCodeExpirationDuration: 300000, // max time between creation of the offer and the token request in ms
                        interval: 300000, // interval between requesting new credential tokens, in seconds
                        tokenExpiresIn: 300, // time of life of the access token, in seconds
                        tokenPath: '/token'
                    }
                }
            }
        });
    }

    debug("starting express server");
    expressSupport.start();

    dumpExpressRoutes(expressSupport.express);
}
