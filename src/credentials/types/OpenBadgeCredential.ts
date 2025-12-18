import { CredentialType } from "#root/credentials/types/CredentialType";
import { Credential } from '#root/credentials/Credential';
import { createUniqueId } from '#root/utils/createUniqueId';
import { Session } from "#root/packages/datastore/index";

export class OpenBadgeCredential extends CredentialType {
    check(credential:Credential): boolean {
        // TODO: check using jsonschema in payload and hardcoded obv3p0 schema
        // Checking claims by randomly looking for presence of attributes is a lot of work.
        // and adds little for the rather complex obv3 schema. So we just skip it entirely.
        return true;
    }

    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        credential.type = "OpenBadgeCredential";

        if (credential.presetCredential) {
          credential.contexts.push("https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json");
          for (const key of Object.keys(credential.presetCredential)) {
            switch (key) {
              case '@context':
                credential.contexts = credential.presetCredential[key];
                break;
              case 'credentialSubject':
                credential.data = credential.presetCredential[key];
                break;
              case 'name':
              case 'description':
                credential.addDictionaryValue(key, credential.presetCredential[key], 'en_US');
                break;
              case 'validFrom':
              case 'issuanceDate':
                credential.metaData.issuanceDate = credential.presetCredential[key];
                break;
              case 'validUntil':
              case 'expirationDate':
                credential.metaData.expirationDate = credential.presetCredential[key];
                break;
              default:
                credential.metaData[key] = credential.presetCredential[key];
                break;
            }
          }
        }
        else {
          const achievement = credential.data?.achievement ?? {};
          const result = credential.data?.result ?? null; 
          const validFrom: string = credential.data?.validFrom;
          const validUntil: string | undefined = credential.data?.validUntil;

          credential.contexts.push("https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json");
          credential.principalId = createUniqueId();

          if (validFrom) {
            credential.metaData.validFrom = validFrom;
            credential.metaData.issuanceDate = validFrom;
          }

          if (validUntil) {
            credential.metaData.validUntil = validUntil;
            credential.metaData.expirationDate = validUntil;
          }

          credential.data = {
            type: ["VerifiableCredential", "OpenBadgeCredential"],
            achievement,
            ...(result !== null && {result})
          };
        }
        return true;
    }
}
