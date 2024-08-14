import { DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolvable } from 'did-resolver'
import { getDidKeyResolver as veramoResolver } from '@veramo/did-provider-key';
import { getDidKeyResolver as blockchainResolver } from '@blockchain-lab-um/did-provider-key'
import { jwk } from '@transmute/did-key.js';

const resolveDidKey = async (
    didUrl: string,
    _parsed: ParsedDID,
    _resolver: Resolvable,
    options: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {
    try {
        const resolver = veramoResolver();
        const retval = await resolver.key(didUrl, _parsed, _resolver, options);

        if (!retval.didResolutionMetadata.error) {
          return retval;
        }
    }
    catch (err: any) {}

    try {
        const retval = await jwk.resolve(didUrl);
        return {
            didDocumentMetadata: {},
            didResolutionMetadata: {},
            didDocument: retval.didDocument
          }
    }
    catch (err:any) {}

    try {
        const resolver = blockchainResolver();
        const retval = await resolver.key(didUrl, _parsed, _resolver, options);

        if (!retval.didResolutionMetadata.error) {
          return retval;
        }
    }
    catch (err: any) {}

    return {
        didDocumentMetadata: {},
        didResolutionMetadata: { error: 'invalidDid', message: 'key method not supported' },
        didDocument: null,
    }
}

export function getDidKeyResolver() {
    return { key: resolveDidKey }
}
  