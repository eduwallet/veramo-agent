import {
  AuthorizationRequest,
  QRCodeOpts,
  TxCode,
} from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts, VcIssuer } from '@sphereon/oid4vci-issuer'
import { HasEndpointOpts, ISingleEndpointOpts } from '@sphereon/ssi-express-support'
import express from 'express'

import {
  accessToken,
  createCredentialOffer,
  getCredential,
  getCredentialOffer,
  getIssueStatus,
  getMetadata,
  pushedAuthorization,
} from './endpoints'

export type ICreateCredentialOfferURIResponse = {
  uri: string
  userPin?: string
  tsCode?: TxCode
}

export interface IGetCredentialOfferEndpointOpts extends ISingleEndpointOpts {
}

export interface ICreateCredentialOfferEndpointOpts extends ISingleEndpointOpts {
  getOfferPath?: string
  qrCodeOpts?: QRCodeOpts
}

export interface IGetIssueStatusEndpointOpts extends ISingleEndpointOpts {
}

export interface IOID4VCIServerOpts extends HasEndpointOpts {
  endpointOpts?: {
    tokenEndpointOpts?: ITokenEndpointOpts
    createCredentialOfferOpts?: ICreateCredentialOfferEndpointOpts
    getCredentialOfferOpts?: IGetCredentialOfferEndpointOpts
    getStatusOpts?: IGetIssueStatusEndpointOpts
    parOpts?: ISingleEndpointOpts
  }
  baseUrl?: string
}

export class IssuerRestServer<DIDDoc extends object> {
  private readonly _issuer: VcIssuer<DIDDoc>
  private authRequestsData: Map<string, AuthorizationRequest> = new Map()
  private readonly _baseUrl: URL
  // private readonly _server?: http.Server
  private readonly _router: express.Router

  constructor(
    opts: IOID4VCIServerOpts & { issuer: VcIssuer<DIDDoc> } /*If not supplied as argument, it will be fully configured from environment variables*/,
  ) {
    this._baseUrl = new URL(opts?.baseUrl ?? opts?.issuer?.issuerMetadata?.credential_issuer ?? 'http://localhost')
    this._router = express.Router()
    this._issuer = opts.issuer;

    // assert that we either refer to an external AS, or that we handle tokens ourselves
    this.assertAccessTokenHandling()

    if (!this.isTokenEndpointDisabled(opts?.endpointOpts?.tokenEndpointOpts)) {
      // OAuth endpoint to handle the consumation of an access token
      accessToken(this.router, this.issuer, this.baseUrl, opts?.endpointOpts?.tokenEndpointOpts)
    }

    /*
     * The Pushed Authorization endpoint allows sending authorization parameters directly to the
     * authorization server using a back channel instead of going through the front channel.
     * This endpoint should return a URL to the authorization server, which would directly
     * show the consent screen and not request authorization parameters.
     * 
     * We are not implementing an authorization server, so we skip this endpoint
     */
    //pushedAuthorization(this.router, this.issuer, this.authRequestsData)

    // This endpoint serves the /.well-known/openid-credential-issuer document
    getMetadata(this.router, this.issuer)

    // OpenID4VC endpoint to retrieve a specific credential
    getCredential(this.router, this.issuer, this.baseUrl, opts?.endpointOpts?.tokenEndpointOpts)

    // Enable the back channel interface to create a new credential offer
    if (opts?.endpointOpts?.createCredentialOfferOpts?.enabled !== false) {
      createCredentialOffer(this.router, this.issuer, opts?.baseUrl, opts?.endpointOpts?.createCredentialOfferOpts)
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

  get issuer(): VcIssuer<DIDDoc> {
    return this._issuer
  }

  private isTokenEndpointDisabled(tokenEndpointOpts?: ITokenEndpointOpts) {
    return tokenEndpointOpts?.tokenEndpointDisabled === true
  }

  private isStatusEndpointEnabled(statusEndpointOpts?: IGetIssueStatusEndpointOpts) {
    return statusEndpointOpts?.enabled !== false
  }

  private assertAccessTokenHandling(tokenEndpointOpts?: ITokenEndpointOpts) {
    const authServer = this.issuer.issuerMetadata.authorization_servers
    if (this.isTokenEndpointDisabled(tokenEndpointOpts)) {
      if (!authServer) {
        throw Error(
          `No Authorization Server (AS) is defined in the issuer metadata and the token endpoint is disabled. An AS or token endpoints needs to be present`,
        )
      }
      console.log('Token endpoint disabled by configuration')
    } else {
      if (authServer) {
        throw Error(
          `A Authorization Server (AS) was already enabled in the issuer metadata (${authServer}). Cannot both have an AS and enable the token endpoint at the same time `,
        )
      }
    }
  }
  get baseUrl(): URL {
    return this._baseUrl
  }
}
