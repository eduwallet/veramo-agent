import { expect, test} from 'vitest';
import { BaseCredential } from '../../credentials/BaseCredential.js';
import { Issuer } from '../../issuer/Issuer.js';

test('BaseCredential constructor', async () => {
    const credential = new BaseCredential(new Issuer({} as unknown as any, {} as unknown as any), '');
    expect(JSON.stringify(credential, null, 2)).toEqual(JSON.stringify({
      "issuer": {
        "metadata": {},
        "options": {},
        "key": null,
        "keyRef": "",
        "sessionData": {
          "states": {}
        },
        "authorizationState": {},
        "nonceStates": {},
        "serverKeys": {},
        "usesNonces": true
      },
      "credentialId": "",
      "automaticallyBindHolder": true
    }, null, 2));
});