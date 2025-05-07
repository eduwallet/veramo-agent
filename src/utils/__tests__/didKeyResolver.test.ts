import { expect, test} from 'vitest';
import { getDidKeyResolver } from '../didKeyResolver';
import {
    DIDDocument,
    DIDResolutionOptions,
    DIDResolutionResult,
    DIDResolver,
    parse as parseDID,
    Resolvable,
    Resolver,
    ServiceEndpoint,
    VerificationMethod,
  } from 'did-resolver'

test('resolving ed25519 key', async () => {
    const keyResolver = getDidKeyResolver();
    const resolver = new Resolver({...keyResolver});
    const result = await resolver.resolve("did:key:z6Mkkf9RiKeaAFaQzQGT2zfqqwCYYbPTNhQvyGXjKJ84kW88")
    expect(result).toBeDefined();
    expect(result.didDocument).toBeDefined();
    expect(result.didDocument?.verificationMethod?.length).toBe(1);
    const verificationMethod = result.didDocument!.verificationMethod!;
    expect(verificationMethod[0].publicKeyJwk).toBeDefined();
    expect(verificationMethod[0].publicKeyJwk?.kty).toBe('OKP');
    expect(verificationMethod[0].publicKeyJwk?.crv).toBe('Ed25519');
});

test('resolving secp256r1 key', async () => {
    const keyResolver = getDidKeyResolver();
    const resolver = new Resolver({...keyResolver});
    const result = await resolver.resolve("did:key:zDnaew3eSC3JmvrFcgwgoGULgcm3iQR9han5k2d4P87vsDkdm")
    expect(result).toBeDefined();
    expect(result.didDocument).toBeDefined();
    expect(result.didDocument?.verificationMethod?.length).toBe(1);
    const verificationMethod = result.didDocument!.verificationMethod!;
    expect(verificationMethod[0].publicKeyJwk).toBeDefined();
    expect(verificationMethod[0].publicKeyJwk?.kty).toBe('EC');
    expect(verificationMethod[0].publicKeyJwk?.crv).toBe('P-256');
});

test('resolving secp256k1 key', async () => {
    const keyResolver = getDidKeyResolver();
    const resolver = new Resolver({...keyResolver});
    const result = await resolver.resolve("did:key:zQ3shjZ5btPjB5qhUqJyH68XczxL11JqCTng4XBwhdy9nVYic")
    expect(result).toBeDefined();
    expect(result.didDocument).toBeDefined();
    expect(result.didDocument?.verificationMethod?.length).toBe(1);
    const verificationMethod = result.didDocument!.verificationMethod!;
    expect(verificationMethod[0].publicKeyJwk).toBeDefined();
    expect(verificationMethod[0].publicKeyJwk?.kty).toBe('EC');
    expect(verificationMethod[0].publicKeyJwk?.crv).toBe('secp256k1');
});

test('resolving jwk key', async () => {
    const keyResolver = getDidKeyResolver();
    const resolver = new Resolver({...keyResolver});
    const result = await resolver.resolve("did:key:z2SpZdbv3LZ9yeUBaekRedETjR3HegR2VYYuS6JvVSXDbCB29vfrer3EwetJVYwJ7qBnMYfrepE16mrjBcug9AoQcf3vphsmF2qhTWRf3rFH5fJ7onG76cAaRzH8YSpUMrFJqLP1RUxudYfF5KENrF17ermCfGfdBYjtYsGTuoeYnGBRBJiJKtAx3uK5ADhCteUhaCW3EwW4ezqx98hmjxxPbTJ")
    expect(result).toBeDefined();
    expect(result.didDocument).toBeDefined();
    expect(result.didDocument?.verificationMethod?.length).toBe(1);
    const verificationMethod = result.didDocument!.verificationMethod!;
    expect(verificationMethod[0].publicKeyJwk).toBeDefined();
    expect(verificationMethod[0].publicKeyJwk?.kty).toBe('EC');
    expect(verificationMethod[0].publicKeyJwk?.crv).toBe('secp256k1');
});
