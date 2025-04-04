import { getResolver } from '@cef-ebsi/key-did-resolver';
import { DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolvable } from 'did-resolver'

export async function resolveJwkAsKey(did:string, _parsed: ParsedDID, _resolver: Resolvable, options: DIDResolutionOptions):Promise<DIDResolutionResult>
{
    const resolver = getResolver();
    return resolver.key(did, _parsed, _resolver, options);
}
