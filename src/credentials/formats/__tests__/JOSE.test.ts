import { vi, expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { JOSE } from '../JOSE';
import { Credential } from '../../Credential';

test('JOSE conversion', async () => {
    const issuer = new Issuer({}, {});
    let dataToSign:any = null; 
    vi.spyOn(issuer, 'signData').mockImplementation(async (arg:Uint8Array):string => {
        dataToSign = arg;
        return 'mocked-signature';
    });
      
    const credential = new Credential();
    credential.issuer = issuer;
    credential.type = 'CredentialTest';
    credential.data = {name:'Test'};
    credential.holder = 'did:test:holder';
    credential.metaData.issuanceDate = '2025-01-01 01:01:01';
    issuer.did = {did: 'did:test:me'};
    issuer.keyRef = '1234';
    issuer.key = {keyType: 'Ed25519', kid: '1234'};

    const jose = new JOSE(credential);
    await jose.sign();

    expect(credential.output).toBeDefined();
    expect(credential.output).toBe('eyJraWQiOiJkaWQ6dGVzdDptZSMxMjM0IiwidHlwIjoidmMrand0IiwiY3R5IjoidmMiLCJpc3MiOiJkaWQ6dGVzdDptZSJ9.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiXSwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkNyZWRlbnRpYWxUZXN0Il0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7Im5hbWUiOiJUZXN0IiwiaWQiOiJkaWQ6dGVzdDpob2xkZXIifSwiaXNzdWVyIjp7ImlkIjoiZGlkOnRlc3Q6bWUifSwidmFsaWRGcm9tIjoiMjAyNS0wMS0wMVQwMTowMTowMSswMTowMCIsImlzcyI6ImRpZDp0ZXN0Om1lIiwic3ViIjoiZGlkOnRlc3Q6aG9sZGVyIn0.mocked-signature')
    expect(dataToSign.length).toBe(464);
});
