import { expect, test} from 'vitest';
import { CredentialType } from '../CredentialType';
import { Credential } from '#root/credentials/Credential';

class TestCredential extends CredentialType
{
    public check(credential:Credential) {
        return true;
    }

    public async resolve(credential:Credential) {
        return true;
    }
}

test('extract origin from old-skool definition', () => {
  const credential = new Credential();
  credential.setConfiguration({
    format: 'jwt_vc_json',
    credential_definition: {
      type:['Test'],
      credentialSubject: {
        claim1: {},
        claim2: {
            origin: [['claim2']]
        },
        claim3: {
            origin: [['claim1'], ['claim2']]
        }
      }
    }
  });

  const crd = new TestCredential();
  expect(crd.check(credential)).toBeTruthy(); // no-op

  const claims = crd.convertConfigToClaimsPaths(credential);
  expect(claims).toStrictEqual([
    { path: ['credentialSubject', 'claim1'], origin: [['#offer', 'claim1']] },
    { path: ['credentialSubject', 'claim2'], origin: [['claim2']] },
    { path: ['credentialSubject', 'claim3'], origin: [['claim1'], ['claim2']] },
  ]);

});

test('extract origin from new definition', () => {
  const credential = new Credential();
  credential.setConfiguration({
    format: 'jwt_vc_json',
    credential_definition: {
      type:['Test'],
      claims: [
        { path: ['claim1'] },
        { path: ['claim2'], origin: [['claim2']]},
        { path: ['claim3', 'claim4'], origin: [['claim1'],['claim2','claim4']]}
      ]
    }
  });

  const crd = new TestCredential();
  expect(crd.check(credential)).toBeTruthy(); // no-op

  const claims = crd.convertConfigToClaimsPaths(credential);
  expect(claims).toStrictEqual([
    { path: ['claim1'], origin: [['#offer', 'claim1']] },
    { path: ['claim2'], origin: [['claim2']] },
    { path: ['claim3','claim4'], origin: [['claim1'], ['claim2','claim4']] },
  ]);
});

test('retrieve attributes based on path', () => {
    const data = {
        claim1: "string1",
        claim2: 2.2,
        claim3: false,
        claim4: null,
        claim5: {
            claim6: 'string6',
            claim7: {
                claim8: 12
            }
        }
    };

    const crd = new TestCredential();
    expect(crd.getAttributeFromPath(data, ['claim1'])).toBe('string1');
    expect(crd.getAttributeFromPath(data, ['claim2'])).toBe(2.2);
    expect(crd.getAttributeFromPath(data, ['claim3'])).toBe(false);
    expect(crd.getAttributeFromPath(data, ['claim4'])).toBe(null);
    expect(crd.getAttributeFromPath(data, ['claim4b'])).toBe(null); // does not exist, still null
    expect(crd.getAttributeFromPath(data, ['claim5','claim6'])).toBe('string6');
    expect(crd.getAttributeFromPath(data, ['claim5','claim7','claim8'])).toBe(12);
    expect(crd.getAttributeFromPath(data, ['claim5','claim8','claim8'])).toBe(null); // does not exist
    expect(crd.getAttributeFromPath(data, ['claim5','claim7','claim9'])).toBe(null); // idem
    expect(crd.getAttributeFromPath(data, ['claim6','claim7','claim8'])).toBe(null); // idem
});

test('copy attributes from data', () => {
const credential = new Credential();
  credential.setConfiguration({
    format: 'jwt_vc_json',
    credential_definition: {
      type:['Test'],
      claims: [
        { path: ['claim1'] }, // automatic origin determination
        { path: ['claim2'], origin: [['claim2']]}, // simple basic case
        { path: ['claim3', 'claim4'], origin: [['claim1']]}, // transforming structure
        { path: ['claim3', 'claim5'], origin: [['#accessData', 'claim1','claim2']]}, // using accessData
        //
        { path: ['claim6'], origin: [['claim6'], ['#accessData', 'claim1','claim3']]}, // 2 options, first one is not available
        { path: ['claim7'], origin: [['claim3'], ['claim1']]}, // 2 options, first one is valid, but it has been replaced already
        { path: ['claim8'], origin: [['claim4'], ['claim5', 'claim7', 'claim9'],['#accessData', 'claimarray']]} // 3 options, first one is null, second one does not exist
      ]
    }
  });

  credential.data = {
        claim1: "string1",
        claim2: 2.2,
        claim3: false,
        claim4: null,
        claim5: {
            claim6: 'string6',
            claim7: {
                claim8: 12
            }
        }
  };
  const accessData = {
        claim1: {
            claim2: "user",
            claim3: "info"
        },
        claimarray: ["list1", "list2", "list3"]
  }

  const expected = {
        claim1: "string1",
        claim2: 2.2,
        claim3: {
            claim4: "string1",
            claim5: 'user'
        },
        claim4: null, // copied directly from the original data
        claim5: {
            claim6: "string6",
            claim7: {
                claim8: 12
            }
        },
        claim6: 'info',
        claim7: {
            claim4: "string1",
            claim5: 'user'
        },
        claim8: ["list1", "list2", "list3"]
  };

    const crd = new TestCredential();
    crd.copyClaimsFromOrigin(credential, accessData);
    expect(credential.data).toStrictEqual(expected);
});

function deferredCredential(claims:any[]) {
    const credential = new Credential();
    credential.setConfiguration({
        format: 'dc+sd-jwt',
        credential_definition: { type: ['Test'], claims }
    });
    return credential;
}

test('#offer reads the separate copy of the offer data when present', () => {
    const credential = deferredCredential([{ path: ['a'], origin: [['#offer', 'a']] }]);
    credential.data = { a: 'merged' };
    credential.offerData = { a: 'offer' };
    new TestCredential().copyClaimsFromOrigin(credential, {});
    expect(credential.data).toStrictEqual({ a: 'offer' });
});

test('#deferred only reads the deferred data', () => {
    const credential = deferredCredential([
        { path: ['a'], origin: [['#deferred', 'a']] },
        { path: ['b'], origin: [['#deferred', 'b']] },
    ]);
    credential.data = { a: 'offer', b: 'offer' };
    credential.offerData = { a: 'offer', b: 'offer' };
    credential.deferredData = { a: 'deferred' };
    new TestCredential().copyClaimsFromOrigin(credential, { a: 'access', b: 'access' });
    // a comes from the deferred data, b is not available there and keeps its original value
    expect(credential.data).toStrictEqual({ a: 'deferred', b: 'offer' });
});

test('#any prefers deferred, then accessData, then offer', () => {
    const credential = deferredCredential([
        { path: ['a'], origin: [['#any', 'a']] },
        { path: ['b'], origin: [['#any', 'b']] },
        { path: ['c'], origin: [['#any', 'c']] },
        { path: ['d'], origin: [['#any', 'd']] },
    ]);
    credential.data = { a: 'offer', b: 'offer', c: 'offer' };
    credential.offerData = { a: 'offer', b: 'offer', c: 'offer' };
    credential.deferredData = { a: 'deferred' };
    new TestCredential().copyClaimsFromOrigin(credential, { a: 'access', b: 'access' });
    expect(credential.data).toStrictEqual({ a: 'deferred', b: 'access', c: 'offer' });
});

test('origins are tried in the configured order', () => {
    const credential = deferredCredential([
        { path: ['a'], origin: [['#offer', 'a'], ['#deferred', 'a']] },
        { path: ['b'], origin: [['#deferred', 'x'], ['#accessData', 'b'], ['#offer', 'b']] },
    ]);
    credential.data = { a: 'offer', b: 'offer' };
    credential.offerData = { a: 'offer', b: 'offer' };
    credential.deferredData = { a: 'deferred' };
    new TestCredential().copyClaimsFromOrigin(credential, { b: 'access' });
    expect(credential.data).toStrictEqual({ a: 'offer', b: 'access' });
});

test('objects are not merged, the first origin with a value wins', () => {
    const credential = deferredCredential([{ path: ['claim1'], origin: [['#deferred', 'claim1'], ['#offer', 'claim1']] }]);
    credential.data = { claim1: { claim2: { claim3: 'a' } } };
    credential.offerData = { claim1: { claim2: { claim3: 'a' } } };
    credential.deferredData = { claim1: { claim2: { claim4: 'b' } } };
    new TestCredential().copyClaimsFromOrigin(credential, {});
    expect(credential.data).toStrictEqual({ claim1: { claim2: { claim4: 'b' } } });
});

test('old school credentialSubject claims are copied onto the credential subject data', () => {
    const credential = new Credential();
    credential.setConfiguration({
        format: 'jwt_vc_json',
        credential_definition: { type: ['Test'], credentialSubject: { name: {}, mail: { origin: [['#accessData', 'email']] } } }
    });
    credential.data = { name: 'Test' };
    new TestCredential().copyClaimsFromOrigin(credential, { email: 'a@b.c' });
    expect(credential.data).toStrictEqual({ name: 'Test', mail: 'a@b.c' });
});

test('missing access data and configuration are handled', () => {
    const credential = deferredCredential([{ path: ['a'], origin: [['#accessData', 'a'], ['#offer', 'a']] }]);
    credential.data = { a: 'offer' };
    new TestCredential().copyClaimsFromOrigin(credential, undefined);
    expect(credential.data).toStrictEqual({ a: 'offer' });

    const empty = new Credential();
    empty.data = { x: 1 };
    new TestCredential().copyClaimsFromOrigin(empty, {});
    expect(empty.data).toStrictEqual({ x: 1 });
});
