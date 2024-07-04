import { DIDDocument } from 'did-resolver'
import { Express } from 'express'

import { IAgentContext, ICredentialIssuer, ICredentialVerifier, IDataStore, IDataStoreORM, IDIDManager, IKeyManager, IResolver } from '@veramo/core'

import { CredentialDataSupplier, VcIssuer } from '@sphereon/oid4vci-issuer'
import { OID4VCIServer } from '@sphereon/oid4vci-issuer-server'
import { IOID4VCIServerOpts } from '@sphereon/oid4vci-issuer-server/lib/OID4VCIServer'
import { ExpressSupport } from '@sphereon/ssi-express-support'
import { getAccessTokenKeyRef, getAccessTokenSignerCallback, IIssuerInstanceArgs, IssuerInstance } from '@sphereon/ssi-sdk.oid4vci-issuer'
import { IOID4VCIIssuer } from '@sphereon/ssi-sdk.oid4vci-issuer'
import { IOID4VCIStore, IIssuerOptsPersistArgs } from '@sphereon/ssi-sdk.oid4vci-issuer-store'

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
  private readonly _restApi: OID4VCIServer<DIDDocument>
  private readonly _instance: IssuerInstance
  private readonly _issuer: VcIssuer<DIDDocument>

  static async init(args: {
    context: IRequiredContext
    issuerOptions: IIssuerOptsPersistArgs
    credentialDataSupplier?: CredentialDataSupplier
    expressSupport: ExpressSupport
    opts?: IOID4VCIServerOpts
  }): Promise<Issuer> {
    const { issuerOptions, context, expressSupport, credentialDataSupplier } = args
    const opts = args.opts ?? {}
    // creates a new instance of the OID4VCI plugin based on the CredentialIssuer member
    const instance = await context.agent.oid4vciGetInstance({ credentialIssuer: issuerOptions.correlationId})
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
    return new Issuer({ context, issuerInstanceArgs: { credentialIssuer: issuerOptions.correlationId}, expressSupport, opts, instance, issuer })
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
    this._restApi = new OID4VCIServer<DIDDocument>(args.expressSupport, { ...opts, issuer: this._issuer })
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

  get restApi(): OID4VCIServer<DIDDocument> {
    return this._restApi
  }

  get instance(): IssuerInstance {
    return this._instance
  }

  get issuer(): VcIssuer<DIDDocument> {
    return this._issuer
  }

  async stop(): Promise<boolean> {
    return this._expressSupport.stop()
  }
}
