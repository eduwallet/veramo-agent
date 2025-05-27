import Debug from 'debug';
const debug = Debug('verifier:didjwk');
import { DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolvable } from 'did-resolver'
import { Factory } from '@muisit/cryptokey';

const resolveDidJwk = async (
    didUrl: string,
    _parsed: ParsedDID,
    _resolver: Resolvable,
    options: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {

    try {
        const key = await Factory.resolve(didUrl);
        if (key) {
            return {
                didDocumentMetadata: {},
                didResolutionMetadata: {},
                didDocument: Factory.toDIDDocument(key)
            };
        }
    }
    catch (err: any) {
        debug('agent did:jwk: ', err);
    }

    debug("returning did:jwk method not supported");
    return {
        didDocumentMetadata: {},
        didResolutionMetadata: { error: 'invalidDid', message: 'did method not supported' },
        didDocument: null,
    }
}

export function getDidJwkResolver() {
    return { key: resolveDidJwk  };
}
