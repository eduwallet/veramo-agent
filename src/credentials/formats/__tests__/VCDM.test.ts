import { vi, expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { VCDM } from '../VCDM';
import { Credential } from '../../Credential';



test('VCDM conversion', async () => {
    const issuer = new Issuer({}, {});
    let dataToSign:any = null; 
    vi.spyOn(issuer, 'signData').mockImplementation(async (arg:Uint8Array):string => {
        dataToSign = arg;
        return 'mocked-signature';
    });
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.addDictionaryValue('name', 'TestCredential', 'en_US');
    credential.addDictionaryValue('name', 'TestDingetje', 'nl_NL');
    credential.addDictionaryValue('description', 'Beschrijving', 'nl_NL');
    credential.addDictionaryValue('issuer_name', 'Name', 'en_US');
    credential.addDictionaryValue('issuer_name', 'Naam', 'nl_NL');
    credential.addDictionaryValue('issuer_description', 'Descr', 'en_US');
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    credential.holder = {type:'kid', did:'did:test:holder', data:'did:test:holder#0'};
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    issuer.did = {did: 'did:test:me'};
    issuer.keyRef = '1234';

    const vcdm = new VCDM(credential);
    const result = await vcdm.build();

    expect(credential.output).toBeUndefined();
    expect(result).toBeDefined();

    //const expected = {"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential","CredentialTest"],"credentialSubject":{"name":"Test","id":"did:test:holder"},"issuer":{"id":"did:test:me","name":[{"@value":"Name","@language":"en_US"},{"@value":"Naam","@language":"nl_NL"}],"description":[{"@value":"Descr","@language":"en_US"}]},"name":[{"@value":"TestCredential","@language":"en_US"},{"@value":"TestDingetje","@language":"nl_NL"}],"description":[{"@value":"Beschrijving","@language":"nl_NL"}],"validFrom":"2025-01-01T01:01:01+01:00"};
    // due to Sphereon and Unime not supporting language objects, we use basic strings
    const expected = {"@context":["https://www.w3.org/ns/credentials/v2"],"type":["VerifiableCredential","CredentialTest"],"credentialSubject":{"name":"Test","id":"did:test:holder"},"issuer":{"id":"did:test:me","name":"Name","description":"Descr"},"name":"TestCredential","description":"Beschrijving","validFrom":"2025-01-01T01:01:01+01:00"};
    expect(result).toStrictEqual(expected);
    expect(dataToSign).toBe(null); // signing not called
});



test('VCDM dates', async () => {
    const issuer = new Issuer({}, {});
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    credential.metaData.expirationDate = '2026-01-01 01:01:01';
    issuer.did = {did: 'did:test:me'};
    issuer.keyRef = '1234';

    const vcdm = new VCDM(credential);
    const result = await vcdm.build();

    expect(result).toBeDefined();
    expect(result.validFrom).toBe('2025-01-01T01:01:01+01:00');
    expect(result.validUntil).toBe('2026-01-01T01:01:01+01:00');
    expect(result.name).toBeUndefined();
    expect(result.description).toBeUndefined();
    expect(result.issuer.name).toBeUndefined();
    expect(result.issuer.description).toBeUndefined();
    expect(result.issuer.id).toBe('did:test:me')
});


test('VCDM holder binding', async () => {
    const issuer = new Issuer({}, {});
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    issuer.did = {did: 'did:test:me'};
    issuer.keyRef = '1234';

    const vcdm = new VCDM(credential);
    let result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialSubject.id).toBeUndefined();

    credential.holder = {type:'kid', did:'did:test:holder', data:'did:test:holder#0'};
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialSubject.id).toBe('did:test:holder');

    credential.automaticallyBindHolder = false;
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialSubject.id).toBeUndefined();

    credential.data = {name:'Test', id:'did:test:subject'};
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialSubject.id).toBe('did:test:subject');

    credential.automaticallyBindHolder = true;
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialSubject.id).toBe('did:test:subject');
});

test('VCDM status lists', async () => {
    const issuer = new Issuer({}, {});
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    issuer.did = {did: 'did:test:me'};
    issuer.keyRef = '1234';

    // single status list is converted to array of length 1, which is allowed in the spec
    // but was explicitely ruled out in DIIPv2 in the early StatusList implementations
    credential.metaData.credentialStatus = {type:'BitstringStatusList', credentialStatus:{type: 'a'}};
    const vcdm = new VCDM(credential);
    let result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialStatus).toBeDefined();
    expect(result.credentialStatus!.length).toBe(1);
    expect(result.credentialStatus![0].type).toBe('a');

    credential.metaData.credentialStatus = [{type:'BitstringStatusList',credentialStatus:{type:'a'}},{type:'RevocationList2021',credentialStatus:{type:'b'}}];
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialStatus).toBeDefined();
    expect(result.credentialStatus!.length).toBe(2);
    expect(result.credentialStatus![0].type).toBe('a');
    expect(result.credentialStatus![1].type).toBe('b');

    // statuslist+jwt is filtered out
    credential.metaData.credentialStatus = [{type:'BitstringStatusList',credentialStatus:{type:'a'}},{type:'statuslist+jwt',credentialStatus:{type:'b'}}];
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.credentialStatus).toBeDefined();
    expect(result.credentialStatus!.length).toBe(1);
    expect(result.credentialStatus![0].type).toBe('a');
});

test('VCDM evidence', async () => {
    const issuer = new Issuer({}, {});
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    issuer.did = {did: 'did:test:me'};
    issuer.keyRef = '1234';

    // single status list is converted to array of length 1, which is allowed in the spec
    // but was explicitely ruled out in DIIPv2 in the early StatusList implementations
    credential.metaData.evidence = {type:'Evidence2020', id: 'https://youtu.be/movie'};
    const vcdm = new VCDM(credential);
    let result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.length).toBe(1);
    expect(result.evidence![0].type).toBe('Evidence2020');
    expect(result.evidence![0].id).toBe('https://youtu.be/movie');

    credential.metaData.evidence = [{type:'Evidence2020', id: 'https://youtu.be/movie'},{type:'Evidence2025', id:'did:you:tube'}];
    result = await vcdm.build();
    expect(result).toBeDefined();
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.length).toBe(2);
    expect(result.evidence![0].type).toBe('Evidence2020');
    expect(result.evidence![1].type).toBe('Evidence2025');
});
