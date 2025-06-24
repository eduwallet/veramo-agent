import Debug from 'debug';
const debug = Debug('issuer:server');
import express, { Express } from 'express'
import { Issuer } from "issuer/Issuer.js";

import {
    accessToken,
    createCredentialOfferResponse,
    getCredential,
    getCredentialOffer,
    getIssueStatus,
    getMetadata,
    getDidSpec,
    getOpenidConfiguration,
    getOAuthConfiguration,
    listCredentials,
    revokeCredential,
} from './endpoints/index.js'
import { getBasePath } from 'utils/getBasePath.js';

export async function createRoutesForIssuer(issuer:Issuer, app:Express) {
    var tokenPath = '/token';
    debug('creating routes for ', issuer.name);
    /*
     * The issuer.options is the object containing the configured issuer options from the conf
     * directory.
     * The issuer.metadata is the configured issuer metadata from the conf directory. It contains
     * a further metadata field that contains the metadata 'following the specs'
     */
    debug("initializing rest api using ", issuer.options);
    issuer.router = express.Router();
    app.use(getBasePath(issuer.options.baseUrl), issuer.router);

    // OAuth endpoint to handle the consumation of an authorization (pre-authorized) token
    debug("adding token path");
    accessToken(issuer, tokenPath);
  
    // This endpoint serves the /.well-known/openid-credential-issuer document
    getMetadata(issuer)
  
    if (issuer.did?.provider == 'did:web') {
        // This endpoint serves the /.well-known/did.json document
        getDidSpec(issuer);
    }
  
    // This endpoint serves the /.well-known/openid-configuration document
    getOpenidConfiguration(issuer, issuer.options.baseUrl + tokenPath);
    getOAuthConfiguration(issuer, issuer.options.baseUrl + tokenPath);
  
    // OpenID4VC endpoint to retrieve a specific credential
    let credentialEndpoint = issuer.metadata.credential_endpoint;
    if (credentialEndpoint.startsWith(issuer.options.baseUrl)) {
        credentialEndpoint = credentialEndpoint.substring(issuer.options.baseUrl.length);
    }
    getCredential(issuer, credentialEndpoint);
  
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

