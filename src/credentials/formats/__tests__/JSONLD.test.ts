import { vi, expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { JSONLD } from '../JSONLD';
import { Credential } from '../../Credential';
import { getContextConfigurationStore } from '../../../contexts/Store';

const context = {
    "@context": {
        "@version": 1.1,
        "@protected": true,
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
        return 'mocked-signature';
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

    const jsonld = new JSONLD(credential);
    await jsonld.sign();

    expect(credential.output).toBeDefined();
    expect(credential.output.proof).toBeDefined();
    expect(credential.output.proof.type).toBe('JsonWebSignature2020');
    expect(credential.output.proof.proofPurpose).toBe('assertionMethod');
    expect(credential.output.proof.proofPurpose).toBe('assertionMethod');
    expect(dataToSign.length).toBe(464);
});
