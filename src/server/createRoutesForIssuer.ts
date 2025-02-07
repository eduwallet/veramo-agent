import Debug from 'debug'
import express from 'express'
import { ExpressSupport } from "@sphereon/ssi-express-support";
import { Issuer } from "issuer/Issuer";
import { getAccessTokenKeyRef, getAccessTokenSignerCallback } from '@sphereon/ssi-sdk.oid4vci-issuer'
import { getAgent } from 'agent';
import { ITokenEndpointOpts } from '@sphereon/oid4vci-issuer';
import { getBasePath } from 'utils/getBasePath'
import { debug } from 'utils/logger'

import {
    accessToken,
    createCredentialOfferResponse,
    getCredential,
    getCredentialOffer,
    getIssueStatus,
    getMetadata,
    getDidSpec,
    pushedAuthorization,
    getOpenidConfiguration,
    getOAuthConfiguration,
    listCredentials,
    revokeCredential,
  } from './endpoints'

export async function createRoutesForIssuer(issuer:Issuer, expressSupport:ExpressSupport) {
    debug('creating routes for ', issuer.name);
    /*
     * The issuer.options is the object containing the configured issuer options from the conf
     * directory.
     * The issuer.metadata is the configured issuer metadata from the conf directory. It contains
     * a further metadata field that contains the metadata 'following the specs'
     */
    debug("initializing rest api using ", issuer.options);
    const metadata = issuer.metadata.metadata;

    var tokenEndpointOpts:ITokenEndpointOpts = {
        //enabled: true,
        tokenEndpointDisabled: false,
        // override the access-token-issuer, by default set to the credential-issuer
        // accessTokenIssuer:
        preAuthorizedCodeExpirationDuration: 300000, // max time between creation of the offer and the token request in ms
        interval: 300000, // interval between requesting new credential tokens, in seconds
        tokenPath: '/token'
    };

    if (metadata?.authorization_server || metadata?.authorization_servers) {
        tokenEndpointOpts.tokenEndpointDisabled = true;
    }

    tokenEndpointOpts.accessTokenSignerCallback = getAccessTokenSignerCallback(
        {
          iss: issuer.did!.did,
          keyRef: issuer.keyRef,
        },
        { agent: getAgent() },
    )

    issuer.router = express.Router();
    expressSupport.express.use(getBasePath(issuer.options.baseUrl), issuer.router)

    // OAuth endpoint to handle the consumation of an access token
    accessToken(issuer, tokenEndpointOpts)
  
    /*
     * The Pushed Authorization endpoint allows sending authorization parameters directly to the
     * AS from the RP using a back channel instead of going through the front channel.
     * This endpoint should return a URL to the authorization server, which would redirect the client.
     * This would only be implemented if this REST server implements the Authorization Server,
     * which we currently do not.
     */
    //pushedAuthorization(issuer.router, issuer, authRequestsData, issuer.options)
  
    // This endpoint serves the /.well-known/openid-credential-issuer document
    getMetadata(issuer)
  
    // This endpoint serves the /.well-known/did.json document
    getDidSpec(issuer);
  
    // This endpoint serves the /.well-known/openid-configuration document
    var tokenPath = tokenEndpointOpts.tokenPath ? (issuer.options.baseUrl + tokenEndpointOpts.tokenPath) : undefined;
    getOpenidConfiguration(issuer, tokenPath);
    getOAuthConfiguration(issuer, tokenPath);
  
    // OpenID4VC endpoint to retrieve a specific credential
    getCredential(issuer, tokenEndpointOpts);
  
    // Enable the back channel interface to create a new credential offer
    createCredentialOfferResponse(issuer, '/api/create-offer', '/get-credential-offer');
  
    // enable the back channel interface to get a specific credential offer JSON object
    getCredentialOffer(issuer, '/get-credential-offer/:id');
  
    // enable the back channel interface to poll the status of an credential offer and see if it was already issued
    getIssueStatus(issuer, '/api/check-offer');

    // allow the front-end issuer to list credentials for further processing
    listCredentials(issuer, '/api/list-credentials');

    // allow the front-end issuer to revoke or unrevoke specific credentials based on an id
    revokeCredential(issuer, '/api/revoke-credential');
}

