import { DIDDocument } from '@veramo/core'
import { AuthorizationRequest } from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts, VcIssuer } from '@sphereon/oid4vci-issuer'
import { HasEndpointOpts, ISingleEndpointOpts } from '@sphereon/ssi-express-support'
import express from 'express'

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
} from './endpoints'
import { IEWIssuerOptsImportArgs } from 'types'

export type ICreateCredentialOfferURIResponse = {
  uri: string
  userPin?: string
}

export interface IOID4VCIServerOpts extends HasEndpointOpts {
  endpointOpts?: {
    tokenEndpointOpts?: ITokenEndpointOpts
    createCredentialOfferOpts?: ISingleEndpointOpts
    getCredentialOfferOpts?: ISingleEndpointOpts
    getStatusOpts?: ISingleEndpointOpts
    parOpts?: ISingleEndpointOpts    
  }
  baseUrl?: string;
  tokenPath?: string;
  credentialOfferPath: string;
}

//instanceArgs: { credentialIssuer: args.issuerOptions.options.correlationId }
export class IssuerRestServer {
  private readonly _issuer: VcIssuer<DIDDocument>
  private authRequestsData: Map<string, AuthorizationRequest> = new Map()
  private readonly _baseUrl: URL
  // private readonly _server?: http.Server
  private readonly _router: express.Router
  private readonly _issuerOptions: IEWIssuerOptsImportArgs;

  constructor(
    opts: IOID4VCIServerOpts & { issuer: VcIssuer<DIDDocument>, issuerOptions:IEWIssuerOptsImportArgs }
  ) {
    this._baseUrl = new URL(opts?.baseUrl ?? opts?.issuer?.issuerMetadata?.credential_issuer ?? 'http://localhost')
    this._router = express.Router()
    this._issuer = opts.issuer;
    this._issuerOptions = opts.issuerOptions;

    if (!this.isTokenEndpointDisabled(opts?.endpointOpts?.tokenEndpointOpts)) {
      // OAuth endpoint to handle the consumation of an access token
      accessToken(this.router, this.issuer, this.baseUrl, opts?.endpointOpts?.tokenEndpointOpts)

      /*
      * The Pushed Authorization endpoint allows sending authorization parameters directly to the
      * AS from the RP using a back channel instead of going through the front channel.
      * This endpoint should return a URL to the authorization server, which would redirect the client.
      * This would only be implemented if this REST server implements the Authorization Server,
      * which we currently do not.
      */
      pushedAuthorization(this.router, this.issuer, this.authRequestsData, this._issuerOptions)
    }

    // This endpoint serves the /.well-known/openid-credential-issuer document
    getMetadata(this.router, this.issuer)

    // This endpoint serves the /.well-known/did.json document
    getDidSpec(this.router, this.issuer, this._issuerOptions);

    // This endpoint serves the /.well-known/openid-configuration document
    var tokenPath = opts.tokenPath ? (this.baseUrl + opts.tokenPath) : undefined;
    getOpenidConfiguration(this.router, this.issuer, this._issuerOptions, this._issuerOptions, tokenPath);

    // OpenID4VC endpoint to retrieve a specific credential
    getCredential(this.router, this.issuer, this.baseUrl, opts?.endpointOpts?.tokenEndpointOpts)

    // Enable the back channel interface to create a new credential offer
    if (opts?.endpointOpts?.createCredentialOfferOpts?.enabled !== false) {
      createCredentialOfferResponse(
          this.router,
          this.issuer,
          opts?.baseUrl || '',
          opts.credentialOfferPath,
          opts?.endpointOpts?.createCredentialOfferOpts || {},
          this._issuerOptions
      );
    }

    // enable the back channel interface to get a specific credential offer JSON object
    if (opts?.endpointOpts?.getCredentialOfferOpts?.enabled !== false) {
      getCredentialOffer(this.router, this.issuer, opts?.baseUrl, opts?.endpointOpts?.getCredentialOfferOpts)
    }

    // enable the back channel interface to poll the status of an credential offer and see if it was already issued
    if (this.isStatusEndpointEnabled(opts?.endpointOpts?.getStatusOpts)) {
      getIssueStatus(this.router, this.issuer, { ...opts?.endpointOpts?.getStatusOpts, baseUrl: this.baseUrl })
    }
  }

  public get router(): express.Router {
    return this._router
  }

  get issuer(): VcIssuer<DIDDocument> {
    return this._issuer
  }

  private isTokenEndpointDisabled(tokenEndpointOpts?: ITokenEndpointOpts) {
    return tokenEndpointOpts?.tokenEndpointDisabled === true
  }

  private isStatusEndpointEnabled(statusEndpointOpts?: IGetIssueStatusEndpointOpts) {
    return statusEndpointOpts?.enabled !== false
  }

  get baseUrl(): URL {
    return this._baseUrl
  }
}
