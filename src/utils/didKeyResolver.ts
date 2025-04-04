import Debug from 'debug';
const debug = Debug('util:didkey');
import { DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolvable } from 'did-resolver'
import { getDidKeyResolver as veramoResolver } from '@veramo/did-provider-key';
import { getDidKeyResolver as agentResolver } from './agentKeyResolver.js';
import { jwk } from '@transmute/did-key.js';

const resolveDidKey = async (
    didUrl: string,
    _parsed: ParsedDID,
    _resolver: Resolvable,
    options: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {

    try {
        const resolver = agentResolver();
        const retval = await resolver.key(didUrl, _parsed, _resolver, options);

        if (!retval.didResolutionMetadata.error) {
            debug("found resolution", retval);
            return retval;
        }
    }
    catch (err: any) {
        debug('agent did:key: ', err);
    }

    try {
        debug("trying veramo resolver for", didUrl);
        const resolver = veramoResolver();
        const retval = await resolver.key(didUrl, _parsed, _resolver, options);

        if (!retval.didResolutionMetadata.error) {
            debug("found resolution", retval);
            return retval;
        }
    }
    catch (err: any) {
        debug('veramo did:key: ', err);
    }

    try {
        debug("trying jwk resolver for", didUrl);
        const retval = await jwk.resolve(didUrl);
        debug("returning ", retval);
        return {
            didDocumentMetadata: {},
            didResolutionMetadata: {},
            didDocument: retval.didDocument
        };
    }
    catch (err:any) {
        debug('jwk did:key', err);
    }

    debug("returning key method not supported");
    return {
        didDocumentMetadata: {},
        didResolutionMetadata: { error: 'invalidDid', message: 'key method not supported' },
        didDocument: null,
    }
}

export function getDidKeyResolver() {
    return { key: resolveDidKey }
}
  