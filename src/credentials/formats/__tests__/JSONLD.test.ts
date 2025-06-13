import { expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { JSONLD } from '../JSONLD';
import { Credential } from '../../Credential';
import { getContextConfigurationStore } from '../../../contexts/Store';
import { VCDM } from '../VCDM';
import { Factory } from '@muisit/cryptokey';

const context = {
    "@context": {
        "@version": 1.1,
        "type": "@type",
        "given": "http://example.net/#given",
        "CredentialTest": {
            "@id": "http://example.net/#CredentialTest",
            "@context": {
                "given": {
                    "@id": "http://example.net/#given",
                    "@type": "@id"
                }
            }
        }
    }
}

test('JSONLD conversion', async () => {
    const issuer = new Issuer({}, {});
    issuer.key = await Factory.createFromType('Secp256r1', "44d2575ca39d5b875b17f3ae372183acd1da561dbbfde6591facbca98b83fb11"); 
    issuer.did = { did: await Factory.toDIDJWK(issuer.key) };
    issuer.keyRef = issuer.key.exportPublicKey();
    const store = getContextConfigurationStore();
    store.add("http://example.net", context);
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {"@context": ["http://example.net"], given:'Test'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.contexts.push("http://example.net");
    credential.output = (new VCDM(credential)).build();
    const output = await JSONLD.sign(credential, credential.output, '2025-01-01T02:02:02');

    expect(output).toBeDefined();
    expect(output.proof).toBeDefined();
    expect(output.proof?.type).toBe('JsonWebSignature2020');
    expect(output.proof?.proofPurpose).toBe('assertionMethod');
    expect(output.proof?.jws).toBe('eyJhbGciOiJFUzI1NiIsImI2NCI6dHJ1ZSwiY3JpdCI6WyJiNjQiXSwia2lkIjoiMDNjNmUyNzkyYzliZTA2Mzk2YTA3ODE1MWJjODllNmY1NTM0MTJjYWIwMDBjN2VjNzFjNWI5OTI5MzgzNTZkOTgwIn0..YoBBc6L6KLrZ55urR00j82q-IUjvWkROfZ8aEsWzeX1sxUQFZw8AZvTyJ4qm-qjLLdS9W00rdoN4MZFueOtrvw');
});

test('JSONLD conversion with unspecced attributes', async () => {
    const issuer = new Issuer({}, {});
    issuer.key = await Factory.createFromType('Secp256r1', "44d2575ca39d5b875b17f3ae372183acd1da561dbbfde6591facbca98b83fb11"); 
    issuer.did = { did: await Factory.toDIDJWK(issuer.key) };
    issuer.keyRef = issuer.key.exportPublicKey();
    const store = getContextConfigurationStore();
    store.add("http://example.net", context);
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    // additional values are added, but because they are not spec-ed in the context, they are ignored
    credential.data = {"@context": ["http://example.net"], given:'Test', unspecced:'No value'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.metaData.evidence = {type:'Evidence2020'}; // not (yet) in the VC context apparently
    credential.contexts.push("http://example.net");

    let output = (new VCDM(credential)).build();
    await expect(JSONLD.sign(credential, output, '2025-01-01T02:02:02')).rejects.toThrow("JWS Safe event handler");
});

const context2 = {
    "@context": {
        "@version": 1.1,
        "given": "http://example.net/#given",
        "unspecced": "http://example.net/#unspecced",

        "CredentialTest": {
            "@id": "http://example.net/credentials#CredentialTest",
            "@context": {
                "given": {
                    "@id": "http://example.net/#given"
                },
                "unspecced": {
                    "@id": "http://example.net/#unspecced"
                }
            }
        },

        "Evidence2020": {
            "@id": "http://example.net/credentials#Evidence2020"
        }
    }
}

test('JSONLD conversion with credential type context', async () => {
    const issuer = new Issuer({}, {});
    issuer.key = await Factory.createFromType('Secp256r1', "44d2575ca39d5b875b17f3ae372183acd1da561dbbfde6591facbca98b83fb11"); 
    issuer.did = { did: await Factory.toDIDJWK(issuer.key)};
    issuer.keyRef = issuer.key.exportPublicKey();
    const store = getContextConfigurationStore();
    store.add("http://example.net", context2);
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    // additional values are added, but because they are not spec-ed in the context, they are ignored
    credential.data = {given:'Test', unspecced:'No value'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.metaData.evidence = {type:'Evidence2020'}; // not (yet) in the VC context apparently
    credential.contexts.push("http://example.net");

    let output = (new VCDM(credential)).build();
    output = await JSONLD.sign(credential, output, '2025-01-01T02:02:02');

    expect(output).toBeDefined();
    expect(output.proof).toBeDefined();
    expect(output.proof?.type).toBe('JsonWebSignature2020');
    expect(output.proof?.proofPurpose).toBe('assertionMethod');
    expect(output.proof?.jws).toBe('eyJhbGciOiJFUzI1NiIsImI2NCI6dHJ1ZSwiY3JpdCI6WyJiNjQiXSwia2lkIjoiMDNjNmUyNzkyYzliZTA2Mzk2YTA3ODE1MWJjODllNmY1NTM0MTJjYWIwMDBjN2VjNzFjNWI5OTI5MzgzNTZkOTgwIn0..kTHliR2khnm9p3fVvNWJmYZtAeeCWWtDAzNIa-KgmqXybtYc7_T8opqMvdLqSbcxmaN6BVD_UWft0KwozOg54g');
});
