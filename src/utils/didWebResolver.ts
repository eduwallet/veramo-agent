import { DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolvable } from 'did-resolver'
import {getResolver} from "web-did-resolver";
import { getIssuerStore } from 'issuer/Store';
import { DIDDocument } from '@veramo/core';

const resolveDidWeb = async (
    didUrl: string,
    _parsed: ParsedDID,
    _resolver: Resolvable,
    options: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {

    // to prevent complicated setups, see if this did is one of the issuer dids
    try {
        const store = getIssuerStore();
        for (const issuerKey of Object.keys(store)) {
            const issuer = store[issuerKey];
            if (issuer.did?.did == didUrl) {
                return {
                    didDocument: issuer.getDidDoc(),
                    didDocumentMetadata: {},
                    didResolutionMetadata: { },
                  }
            }
        }
    }
    catch (err:any) {}

    try {
        const resolver = getResolver();
        const retval = await resolver.web(didUrl, _parsed, _resolver, options);

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

export function getDidWebResolver() {
    return { web: resolveDidWeb }
}
  