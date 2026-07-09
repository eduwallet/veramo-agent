import Debug from 'debug';
const debug = Debug('issuer:server');
import express, { Express, Router } from 'express'
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
    getNonce,
} from './endpoints/index.js'
import { getOIDFed } from './endpoints/getOIDFed.js';

export async function createRoutesForIssuer(issuer:Issuer, app:Express, wellKnownRouter:Router) {
    // to support internal redirections, we set up the routes on <base-url>/<tenant>/...
    // but use the issuer.options.baseUrl to point to the external endpoint (e.g.: <tenant>.<base-url>/...)
    // The following statement makes it possible to set issuer.options.baseUrl == <app-baseUrl>/<tenant>
    // and not use the redirections.
    // However, for this to work, the name and the baseUrl should match in the configuration
    const basePath = issuer.basePath();
    const tokenPath = '/token';

    debug('creating routes for ', issuer.name);
    /*
     * The issuer.options is the object containing the configured issuer options from the conf
     * directory.
     * The issuer.metadata is the configured issuer metadata from the conf directory. It contains
     * a further metadata field that contains the metadata 'following the specs'
     */
    debug("initializing rest api using ", issuer.options);
    issuer.router = express.Router();
    app.use(basePath, issuer.router);

    // OAuth endpoint to handle the consumation of an authorization (pre-authorized) token
    debug("adding token path");
    accessToken(issuer, tokenPath);

    if (issuer.usesNonces) {
        // nonce endpoint (ID2)
        getNonce(issuer);
    }
  
    // This endpoint serves the /.well-known/openid-credential-issuer document
    getMetadata(issuer, basePath, wellKnownRouter)

    // Serving the /.well-known/openid-federation document
    getOIDFed(issuer);
  
    if (issuer.did?.provider == 'did:web') {
        // This endpoint serves the /.well-known/did.json document
        getDidSpec(issuer);
    }
  
    // This endpoint serves the /.well-known/openid-configuration document
    // only required if we act as AS
    if (!issuer.usesAuthorisedCodeFlow()) {
        // the tokenpath is an external URL, so gets prepended with the baseUrl, but not the basePath
        getOpenidConfiguration(issuer, basePath, issuer.options.baseUrl + tokenPath, wellKnownRouter);
        getOAuthConfiguration(issuer, basePath, issuer.options.baseUrl + tokenPath, wellKnownRouter);
    }
  
    // this is hard coded in the Issuer when metadata is generated
    getCredential(issuer, '/credentials');
  
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

    // STATLIST-TODO: add api interfaces to revoke specific indexes of a named status list
    // Add endpoint to get and set the status, get the statuslist credential
    // see the endpoints under endpoints/statuslist
}

