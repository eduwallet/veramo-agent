import { expect, test} from 'vitest';
import { OpenBadgeCredential } from '../OpenBadgeCredential';
import { Issuer } from '../../issuer/Issuer.js';
import { CredentialProofData } from "../../types/internal.js";

test('generate OpenBadgeCredential without evidence', async () => {
  const credential = new OpenBadgeCredential(new Issuer({} as unknown as any, {} as unknown as any), '');
  const proofData: CredentialProofData = {
    session: {} as any,
    credentialDataSet: {
      credentialConfiguration: {
          format: 'jwt_vc',
          credential_definition: {
              type: [],
          },
      } as any,
      credentialId: '',
      data: {},
    },
    nonce: '',
    key: '',
    did: '',
  }
  const result = await credential.generate(proofData);
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
  expect(JSON.stringify(result, null, 2)).toEqual(JSON.stringify({
    "format": "jwt_vc_json",
    "credential": {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json"
      ],
      "type": [
        "VerifiableCredential",
        "OpenBadgeCredential"
      ],
      "issuer": {
        "id": ""
      },
      "name": "",
      "description": "",
      "credentialSubject": {
        "type": [
          "VerifiableCredential",
          "OpenBadgeCredential"
        ],
        "achievement": {}
      }
    }
  }, null, 2));
});


test('generate OpenBadgeCredential with evidence', async () => {
  const credential = new OpenBadgeCredential(new Issuer({} as unknown as any, {} as unknown as any), '');
  const proofData: CredentialProofData = {
    session: {} as any,
    credentialDataSet: {
      credentialConfiguration: {
          format: 'jwt_vc',
          credential_definition: {
              type: [],
          },
      } as any,
      credentialId: '',
      data: {
        evidence: [ // copied example from https://www.w3.org/TR/vc-data-model-2.0/#evidence
          {
              "id": "https://videos.example/training/alice-espresso.mp4",
              "type": ["Evidence"],
              "name": "Talk-aloud video of double espresso preparation",
              "description": "This is a talk-aloud video of Alice demonstrating preparation of a double espresso drink.",
              "digestMultibase": "uELq9FnJ5YLa5iAszyJ518bXcnlc5P7xp1u-5uJRDYKvc"
          },
        ],
      },
    },
    nonce: '',
    key: '',
    did: '',
  }
  const result = await credential.generate(proofData);
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
  expect(JSON.stringify(result, null, 2)).toEqual(JSON.stringify({
    "format": "jwt_vc_json",
    "credential": {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json"
      ],
      "type": [
        "VerifiableCredential",
        "OpenBadgeCredential"
      ],
      "issuer": {
        "id": ""
      },
      "name": "",
      "description": "",
      "credentialSubject": {
        "type": [
          "VerifiableCredential",
          "OpenBadgeCredential"
        ],
        "achievement": {}
      },
      "evidence": [
        {
          "id": "https://videos.example/training/alice-espresso.mp4",
          "type": [
            "Evidence"
          ],
          "name": "Talk-aloud video of double espresso preparation",
          "description": "This is a talk-aloud video of Alice demonstrating preparation of a double espresso drink.",
          "digestMultibase": "uELq9FnJ5YLa5iAszyJ518bXcnlc5P7xp1u-5uJRDYKvc"
        }
      ]
    }
  }, null, 2));
});
