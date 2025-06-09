import {
  DIDResolutionResult,
  DIDResolver,
  ParsedDID,
  Resolvable,
} from 'did-resolver'
import { Factory } from '@muisit/cryptokey'

const resolveDidKey: DIDResolver = async (
  didUrl: string,
  _parsed: ParsedDID,
  _resolver: Resolvable,
  options: any,
): Promise<DIDResolutionResult> => {
  try {
    const cryptoKey = await Factory.createFromDIDKey(didUrl);
    return {
        didDocumentMetadata: {},
        didResolutionMetadata: {},
        didDocument: null,// ...cryptoKey.didDocument(),
    }
  }
  catch (err: any) {
    return {
      didDocumentMetadata: {},
      didResolutionMetadata: { error: 'invalidDid', message: err.toString() },
      didDocument: null,
    }
  }
}

/**
 * Provides a mapping to a did:key resolver, usable by {@link did-resolver#Resolver}.
 *
 * @public
 */
export function getDidKeyResolver() {
  return { key: resolveDidKey }
}
