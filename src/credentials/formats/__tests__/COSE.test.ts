import { vi, expect, test} from 'vitest';
import { Issuer } from '../../../issuer/Issuer';
import { COSE } from '../COSE';
import { Credential } from '../../Credential';

test('COSE conversion', async () => {
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

    const cose = new COSE(credential);
    await cose.sign();

    expect(credential.output).toBeDefined();
    expect(credential.output).toBe('hEahY2FsZ_ekY3R5cHNhcHBsaWNhdGlvbi92Yytjb3NlY2N0eW5hcHBsaWNhdGlvbi92Y2NraWRwZGlkOnRlc3Q6bWUjMTIzNGNpc3NrZGlkOnRlc3Q6bWVY66doQGNvbnRleHSBeCRodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjJkdHlwZYJ0VmVyaWZpYWJsZUNyZWRlbnRpYWxuQ3JlZGVudGlhbFRlc3RxY3JlZGVudGlhbFN1YmplY3SiZG5hbWVkVGVzdGJpZG9kaWQ6dGVzdDpob2xkZXJmaXNzdWVyoWJpZGtkaWQ6dGVzdDptZWl2YWxpZEZyb214GTIwMjUtMDEtMDFUMDE6MDE6MDErMDE6MDBjaXNza2RpZDp0ZXN0Om1lY3N1Ym9kaWQ6dGVzdDpob2xkZXKiZHR5cGVmQnVmZmVyZGRhdGGQGG0YbxhjGGsYZRhkGC0YcxhpGGcYbhhhGHQYdRhyGGU')
    expect(dataToSign.length).toBe(275);
});
