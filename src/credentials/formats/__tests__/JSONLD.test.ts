import { vi, expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { JSONLD } from '../JSONLD';
import { Credential } from '../../Credential';
import { getContextConfigurationStore } from '../../../contexts/Store';
import { toString } from 'uint8arrays';
import { VCDM } from '../VCDM';

const context = {
    "@context": {
        "@version": 1.1,
        "@protected": true,
        "type": "@type",
        "given": "http://example.net/#given"
    }
}

test('JSONLD conversion', async () => {
    const issuer = new Issuer({}, {});
    const store = getContextConfigurationStore();
    store.add("http://example.net", context);
    let dataToSign:any = null; 
    vi.spyOn(issuer, 'signData').mockImplementation(async (arg:Uint8Array):string => {
        dataToSign = arg;
        return toString(arg, 'base64url');
    });
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {"@context": ["http://example.net"], given:'Test'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.contexts.push("http://example.net");
    issuer.did = {did: 'did:test:me', provider:'did:test', keys:[], services:[]};
    issuer.keyRef = '1234';
    issuer.key = {keyType: 'Ed25519', kid: '1234'};
    let output = (new VCDM(credential)).build();
    output = await JSONLD.sign(credential, output, '2025-01-01T02:02:02');

    expect(output).toBeDefined();
    expect(output.proof).toBeDefined();
    expect(output.proof?.type).toBe('JsonWebSignature2020');
    expect(output.proof?.proofPurpose).toBe('assertionMethod');
    expect(output.proof?.jws).toBe('eyJiNjQiOnRydWUsImNyaXQiOlsiYjY0Il19..ZXlKaU5qUWlPblJ5ZFdVc0ltTnlhWFFpT2xzaVlqWTBJbDE5LlJIdVR0Rk1IeWhBUFNxLU12R0ZNLXNzYUs3dXdWcjVkZlU5YjV4WHp2YUE0Nm5qdmdPWG5oaUhIMFFXbEVlVDN2cXpMb2pPTjQ2NnFjUHdNSTR4NkhR');
    expect(dataToSign.length).toBe(123);
});

test('JSONLD conversion with unspecced attributes', async () => {
    const issuer = new Issuer({}, {});
    const store = getContextConfigurationStore();
    store.add("http://example.net", context);
    let dataToSign:any = null; 
    vi.spyOn(issuer, 'signData').mockImplementation(async (arg:Uint8Array):string => {
        dataToSign = arg;
        return toString(arg, 'base64url');
    });
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    // additional values are added, but because they are not spec-ed in the context, they are ignored
    credential.data = {"@context": ["http://example.net"], given:'Test', unspecced:'No value'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.metaData.evidence = {type:'Evidence2020'}; // not (yet) in the VC context apparently
    credential.contexts.push("http://example.net");
    issuer.did = {did: 'did:test:me', provider:'did:test', keys:[], services:[]};
    issuer.keyRef = '1234';
    issuer.key = {keyType: 'Ed25519', kid: '1234'};

    let output = (new VCDM(credential)).build();
    output = await JSONLD.sign(credential, output, '2025-01-01T02:02:02');

    expect(output).toBeDefined();
    expect(output.proof).toBeDefined();
    expect(output.proof?.type).toBe('JsonWebSignature2020');
    expect(output.proof?.proofPurpose).toBe('assertionMethod');
    expect(output.proof?.jws).toBe('eyJiNjQiOnRydWUsImNyaXQiOlsiYjY0Il19..ZXlKaU5qUWlPblJ5ZFdVc0ltTnlhWFFpT2xzaVlqWTBJbDE5LlJIdVR0Rk1IeWhBUFNxLU12R0ZNLXNzYUs3dXdWcjVkZlU5YjV4WHp2YUE0Nm5qdmdPWG5oaUhIMFFXbEVlVDN2cXpMb2pPTjQ2NnFjUHdNSTR4NkhR');
    expect(dataToSign.length).toBe(123);
});

const context2 = {
    "@context": {
        "@version": 1.1,

        "given": "http://example.net/#given",
        "unspecced": "http://example.net/#unspecced",
        "CredentialTest": {
            "@id": "http://example.net/credentials#CredentialTest",
        }
    }
}

test('JSONLD conversion with credential type context', async () => {
    const issuer = new Issuer({}, {});
    const store = getContextConfigurationStore();
    store.add("http://example.net", context2);
    let dataToSign:any = null; 
    vi.spyOn(issuer, 'signData').mockImplementation(async (arg:Uint8Array):string => {
        dataToSign = arg;
        return toString(arg, 'base64url');
    });
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    // additional values are added, but because they are not spec-ed in the context, they are ignored
    credential.data = {given:'Test', unspecced:'No value'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.metaData.evidence = {type:'Evidence2020'}; // not (yet) in the VC context apparently
    credential.contexts.push("http://example.net");
    issuer.did = {did: 'did:test:me', provider:'did:test', keys:[], services:[]};
    issuer.keyRef = '1234';
    issuer.key = {keyType: 'Ed25519', kid: '1234'};

    let output = (new VCDM(credential)).build();
    output = await JSONLD.sign(credential, output, '2025-01-01T02:02:02');

    expect(output).toBeDefined();
    expect(output.proof).toBeDefined();
    expect(output.proof?.type).toBe('JsonWebSignature2020');
    expect(output.proof?.proofPurpose).toBe('assertionMethod');
    expect(output.proof?.jws).toBe('eyJiNjQiOnRydWUsImNyaXQiOlsiYjY0Il19..ZXlKaU5qUWlPblJ5ZFdVc0ltTnlhWFFpT2xzaVlqWTBJbDE5LlJIdVR0Rk1IeWhBUFNxLU12R0ZNLXNzYUs3dXdWcjVkZlU5YjV4WHp2YUR2eGtVX05MUVVYYTZaVDM0TmhlR1hHVFFoYTFQbFFzcG1fbzV5Z1BHTFp3');
    expect(dataToSign.length).toBe(123);
});