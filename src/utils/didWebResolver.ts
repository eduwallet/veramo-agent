import { DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolvable } from 'did-resolver'
import {getResolver} from "web-did-resolver";
import { getIdentifier } from './did';
import { didOptConfigs } from 'environment';
import { toDidDocument } from '@sphereon/ssi-sdk-ext.did-utils';

const resolveDidWeb = async (
    didUrl: string,
    _parsed: ParsedDID,
    _resolver: Resolvable,
    options: DIDResolutionOptions,
  ): Promise<DIDResolutionResult> => {

    // to prevent complicated setups, see if this did is one of the dids we have configured
    try {
        for (const opts of didOptConfigs.asArray) {
            const did = opts.did;
            let identifier = did ? await getIdentifier(did) : undefined;
            if (identifier?.did == didUrl) {
                return {
                    didDocument: toDidDocument(identifier)!,
                    didDocumentMetadata: {},
                    didResolutionMetadata: { }
                };
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
  