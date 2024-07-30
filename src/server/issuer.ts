import { DIDDocument } from 'did-resolver'
import { Express } from 'express'

import { IAgentContext, ICredentialIssuer, ICredentialVerifier, IDataStore, IDataStoreORM, IDIDManager, IKeyManager, IResolver } from '@veramo/core'

import { CredentialDataSupplier, VcIssuer } from '@sphereon/oid4vci-issuer'
import { ExpressSupport } from '@sphereon/ssi-express-support'
import { getAccessTokenKeyRef, getAccessTokenSignerCallback, IIssuerInstanceArgs, IssuerInstance } from '@sphereon/ssi-sdk.oid4vci-issuer'
import { IOID4VCIIssuer } from '@sphereon/ssi-sdk.oid4vci-issuer'
import { IOID4VCIStore, IIssuerOptsPersistArgs } from '@sphereon/ssi-sdk.oid4vci-issuer-store'

import { IssuerRestServer, IOID4VCIServerOpts } from './IssuerRestServer'
import { getBasePath } from '@utils/getBasePath'
import {getCredentialDataSupplier} from "@utils/oid4vciCredentialSuppliers";

export type IRequiredContext = IAgentContext<IPlugins>

export type IPlugins = IDIDManager &
  IKeyManager &
  IDataStore &
  IDataStoreORM &
  IResolver &
  IOID4VCIStore &
  IOID4VCIIssuer &
  ICredentialVerifier &
  ICredentialIssuer

export interface IOID4VCIRestAPIOpts extends IOID4VCIServerOpts {}

export class Issuer {
  private readonly _expressSupport: ExpressSupport
  private readonly _context: IRequiredContext
  private readonly _opts?: IOID4VCIRestAPIOpts
  private readonly _restApi: IssuerRestServer;
  private readonly _instance: IssuerInstance
  private readonly _issuer: VcIssuer<DIDDocument>
  private readonly _issuerInstanceArgs: IIssuerInstanceArgs;

  static async init(args: {
    context: IRequiredContext
    issuerOptions: IIssuerOptsPersistArgs
    expressSupport: ExpressSupport
    opts?: IOID4VCIServerOpts
  }): Promise<Issuer> {
    const { issuerOptions, context, expressSupport } = args
    const opts = args.opts ?? {}
    // creates a new instance of the OID4VCI plugin based on the CredentialIssuer member
    const instance = await context.agent.oid4vciGetInstance({ credentialIssuer: issuerOptions.correlationId})
    const credentialDataSupplier = getCredentialDataSupplier(issuerOptions)
    const issuer = await instance.get({ context, credentialDataSupplier: credentialDataSupplier })

    if (!opts.endpointOpts) {
      opts.endpointOpts = {}
    }
    if (!opts.endpointOpts.tokenEndpointOpts) {
      opts.endpointOpts.tokenEndpointOpts = {
        accessTokenIssuer: instance.metadataOptions.credentialIssuer ?? issuer.issuerMetadata.credential_issuer,
      }
    }
    if (
      opts?.endpointOpts.tokenEndpointOpts?.tokenEndpointDisabled !== true &&
      typeof opts?.endpointOpts.tokenEndpointOpts?.accessTokenSignerCallback !== 'function'
    ) {
      let keyRef: string | undefined
      const tokenOpts = {
        iss: opts.endpointOpts.tokenEndpointOpts.accessTokenIssuer ?? instance.metadataOptions.credentialIssuer,
        didOpts: instance.issuerOptions.didOpts,
      }
      if (!tokenOpts.didOpts.identifierOpts?.kid || tokenOpts.didOpts.identifierOpts?.kid?.startsWith('did:')) {
        keyRef = await getAccessTokenKeyRef(tokenOpts, context)
      }

      opts.endpointOpts.tokenEndpointOpts.accessTokenSignerCallback = getAccessTokenSignerCallback(
        {
          ...tokenOpts,
          keyRef,
        },
        args.context,
      )
    }
    return new Issuer({ context, issuerInstanceArgs: { credentialIssuer: issuerOptions.correlationId}, expressSupport, opts, instance, issuer})
  }

  private constructor(args: {
    issuer: VcIssuer<DIDDocument>
    instance: IssuerInstance
    context: IRequiredContext
    issuerInstanceArgs: IIssuerInstanceArgs
    expressSupport: ExpressSupport
    opts: IOID4VCIRestAPIOpts
  }) {
    const { context, opts } = args
    this._context = context
    this._opts = opts ?? {}
    this._expressSupport = args.expressSupport
    this._issuer = args.issuer
    this._instance = args.instance
    this._restApi = new IssuerRestServer({ ...opts, issuer: this._issuer, instanceArgs: args.issuerInstanceArgs })
    this._expressSupport.express.use(getBasePath(this._restApi.baseUrl), this.restApi.router)
    this._issuerInstanceArgs = args.issuerInstanceArgs;
  }

  get express(): Express {
    return this._expressSupport.express
  }

  get context(): IRequiredContext {
    return this._context
  }

  get opts(): IOID4VCIRestAPIOpts | undefined {
    return this._opts
  }

  get restApi(): IssuerRestServer {
    return this._restApi
  }

  get instance(): IssuerInstance {
    return this._instance
  }

  get issuer(): VcIssuer<DIDDocument> {
    return this._issuer
  }

  get issuerInstanceArgs(): IIssuerInstanceArgs {
    return this._issuerInstanceArgs;
  }

  async stop(): Promise<boolean> {
    return this._expressSupport.stop()
  }
}
