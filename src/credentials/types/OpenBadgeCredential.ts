import { CredentialType } from "./CredentialType";
import { CredentialDisplay } from "types/specification/metadata";
import { Credential } from '../Credential';
import { createUniqueId } from '#root/utils/createUniqueId';

export class OpenBadgeCredential extends CredentialType {
  check(credential:Credential): boolean {
    // TODO: check using jsonschema in payload and hardcoded obv3p0 schema
    // Checking claims by randomly looking for presence of attributes is a lot of work.
    // and adds little for the rather complex obv3 schema. So we just skip it entirely.
    return true;
  }

  public async resolve(credential:Credential) {
    const credentialDisplay:CredentialDisplay|undefined = 
        credential.configuration?.display?.length ? (credential.configuration.display[0] as CredentialDisplay) : undefined;

    if (credentialDisplay.name) {
        credential.metaData.name = credentialDisplay.name;
    }
    if (credentialDisplay.description) {
        credential.metaData.description = credentialDisplay.description;
    }

    const display = (credential.issuer.metadata.display ?? [{}])[0];
    credential.metaData.issuer = {
        id: credential.issuer.did!.did,
        name: display.name ?? credential.issuer.options.baseUrl,
        description: display.description ?? ''
    };

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

    credential.type = "OpenBadgeCredential";
    credential.data = {
      type: ["VerifiableCredential", "OpenBadgeCredential"],
      achievement,
      ...(result !== null && {result})
    };
  }
}
