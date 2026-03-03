import Debug from 'debug';
const debug = Debug('issuer:obc');

import { CredentialType } from "#root/credentials/types/CredentialType";
import { Credential } from '#root/credentials/Credential';
import { createUniqueId } from '#root/utils/createUniqueId';
import { Session } from "#root/database/entities/index";

export class OpenBadgeCredential extends CredentialType {
    check(credential:Credential): boolean {
        // TODO: check using jsonschema in payload and hardcoded obv3p0 schema
        // Checking claims by randomly looking for presence of attributes is a lot of work.
        // and adds little for the rather complex obv3 schema. So we just skip it entirely.
        return true;
    }

    public async resolve(credential:Credential, session:Session) {
        debug('resolving OBC credential instance');
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        credential.type = "OpenBadgeCredential";

        if (credential.presetCredential) {
          debug("preset credential detected", credential.presetCredential);
          credential.contexts.push("https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json");
          for (const key of Object.keys(credential.presetCredential)) {
            switch (key) {
              case '@context':
                credential.contexts = credential.presetCredential[key];
                break;
              case 'credentialSubject':
                const data = Object.assign({}, credential.presetCredential[key]);
                // if the preset credential has an id in the credentialSubject, remove it. We need this to
                // bind our key
                if (data.id) {
                  delete data.id;
                }
                credential.data = data;
                break;
              case 'name':
              case 'description':
                credential.addDictionaryValue(key, credential.presetCredential[key], 'en_US');
                break;
              case 'validFrom':
              case 'issuanceDate':
                debug("matching issuanceDate to metadata");
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
          debug('creating credential based on credential data from offer');
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
