import { IAgentContext, IIdentifier, IKey, IKeyManager, IService, RequireOnly, MinimalImportableKey } from '@veramo/core-types'
import { AbstractIdentifierProvider } from '@veramo/did-manager'
import { Factory } from '@muisit/cryptokey';
import { CreateIdentifierArgs, CreateIdentifierOptions } from '#root/types/index';
import Debug from 'debug'
import { IKeyManagerCreateArgs } from '@veramo/core';

const debug = Debug('issuer:did-web')

type IContext = IAgentContext<IKeyManager>

export class WebDIDProvider extends AbstractIdentifierProvider {
  private defaultKms: string

  constructor(options: { defaultKms: string }) {
    super()
    this.defaultKms = options.defaultKms
  }

  async createIdentifier(args:CreateIdentifierArgs,context: IContext): Promise<Omit<IIdentifier, 'provider'>> {
    const keyType = (args.options?.keyType && args.options.keyType) || 'Ed25519'
    const key = await this.importOrGenerateKey(
      {
        kms: args.kms || this.defaultKms,
        options: {
          keyType,
          ...(args.options?.privateKeyHex && { privateKeyHex: args.options.privateKeyHex }),
        },
      },
      context,
    )

    const cryptoKey = await Factory.createFromType(key.type, key.privateKeyHex);
    cryptoKey.setPublicKey(key.publicKeyHex);
    const methodSpecificId:string = 'did:web:' + args.alias;

    const identifier: Omit<IIdentifier, 'provider'> = {
      did: methodSpecificId,
      controllerKeyId: key.kid,
      keys: [key],
      services: [],
    }
    debug('Created', identifier.did)
    return identifier
  }

  async updateIdentifier(
    args: {
      did: string
      kms?: string | undefined
      alias?: string | undefined
      options?: any
    },
    context: IAgentContext<IKeyManager>,
  ): Promise<IIdentifier> {
    throw new Error('WebDIDProvider updateIdentifier not implemented.')
  }

  async deleteIdentifier(identifier: IIdentifier, context: IContext): Promise<boolean> {
    for (const { kid } of identifier.keys) {
      await context.agent.keyManagerDelete({ kid })
    }
    return true
  }

  async addKey(
    { identifier, key, options }: { identifier: IIdentifier; key: IKey; options?: any },
    context: IContext,
  ): Promise<any> {
    throw Error('WebDIDProvider addKey not implemented')
  }

  async addService(
    { identifier, service, options }: { identifier: IIdentifier; service: IService; options?: any },
    context: IContext,
  ): Promise<any> {
    throw Error('WebDIDProvider addService not implemented')
  }

  async removeKey(
    args: { identifier: IIdentifier; kid: string; options?: any },
    context: IContext,
  ): Promise<any> {
    throw Error('WebDIDProvider removeKey not implemented')
  }

  async removeService(
    args: { identifier: IIdentifier; id: string; options?: any },
    context: IContext,
  ): Promise<any> {
    throw Error('WebDIDProvider removeService not implemented')
  }

  private async importOrGenerateKey(
    args: {
      kms: string
      options: RequireOnly<CreateIdentifierOptions, 'keyType'>
    },
    context: IContext,
  ): Promise<IKey> {
    if (args.options.privateKeyHex) {
      return context.agent.keyManagerImport({
        kms: args.kms || this.defaultKms,
        type: args.options.keyType,
        privateKeyHex: args.options.privateKeyHex,
      } as MinimalImportableKey)
    }
    return context.agent.keyManagerCreate({
      kms: args.kms || this.defaultKms,
      type: args.options.keyType,
    } as IKeyManagerCreateArgs)
  }
}
