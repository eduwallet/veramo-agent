import { expect, test} from 'vitest';
import { OpenBadgeCredential } from '../OpenBadgeCredential';
import { Credential } from '../../Credential';
import { Issuer } from '../../../issuer/Issuer';

test('generate OpenBadgeCredential without evidence', async () => {
  const credential = new Credential();
  credential.issuer = new Issuer({} as unknown as any, {} as unknown as any);
  credential.data = { achievement: { name: "Test"}, result: { value: 10 }, validFrom: '2000-01-01', validUntil: '2010-01-01'};
  credential.setConfiguration({
    format: 'jwt_vc_json',
    credential_definition: {
      type: []
    }
  });

  const obc = new OpenBadgeCredential();
  expect(obc.check()).toBeTruthy();

  const output = await obc.resolve(credential);
  expect(output).toBeTruthy();
  expect(credential.type).toBe('OpenBadgeCredential');
  expect(credential.data?.type).toStrictEqual(['VerifiableCredential', 'OpenBadgeCredential']);
  expect(credential.data?.achievement).toStrictEqual({ name: "Test"});
  expect(credential.data?.result).toStrictEqual({ value: 10 });
  expect(credential.metaData.validFrom).toBe('2000-01-01');
  expect(credential.metaData.validUntil).toBe('2010-01-01');
  expect(credential.metaData.issuanceDate).toBe('2000-01-01');
  expect(credential.metaData.expirationDate).toBe('2010-01-01');
  expect(credential.contexts).toStrictEqual(["https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json"]);
});
