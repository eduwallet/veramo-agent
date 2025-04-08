import Debug from 'debug';
const debug = Debug('issuer:credentials');
import { BaseCredential } from "./BaseCredential";
import { CredentialProofData, CredentialResult } from "types/internal";
import { getCredentialTypeFromConfig } from "utils/getCredentialTypeFromConfig";
import { CredentialDisplay } from "types/specification/metadata";
import { CredentialPayload } from "@veramo/core";

enum CredentialType {
  VerifiableCredential = 'VerifiableCredential',
  OpenBadgeCredential = 'OpenBadgeCredential',
}

export class OpenBadgeCredential extends BaseCredential {
  check(_claims: any): boolean {
    // TODO: check using jsonschema in payload and hardcoded obv3p0 schema
    // Checking claims by randomly looking for presence of attributes is a lot of work.
    // and adds little for the rather complex obv3 schema. So we just skip it entirely.
    return true;
  }

  public async generate(proofData:CredentialProofData): Promise<CredentialResult> {
    debug('OpenBadgeCredential.generate()', proofData);

    const display = (this.issuer.metadata.display ?? [{}])[0];
    const { credentialDataSet } = proofData;
    const { credentialConfiguration, data } = credentialDataSet;
    const type = getCredentialTypeFromConfig(credentialConfiguration!);
    const credentialDisplay:CredentialDisplay|undefined = credentialConfiguration?.display?.length ? credentialConfiguration.display[0] : undefined;

    const achievement = data.credential?.credentialSubject?.achievement ?? {};
    debug('achievement', achievement);

    const validFrom: string = data.credential?.validFrom;
    const validUntil: string | undefined = data.credential?.validUntil;

    // TODO: Can the did ever be null? The sphereon types allow it, but it seems this
    // would not be a valid state in our actual badge and issuer setup. Probably
    // replace the Sphereon Issue type with a more specific one.
    const issuer_id = this.issuer.did?.did || '';

    const badgeTypes = [
      CredentialType.VerifiableCredential,
      CredentialType.OpenBadgeCredential,
    ];

    // See https://www.imsglobal.org/spec/ob/v3p0/#org.1edtech.ob.v3p0.achievementcredential.class
    const credential: CredentialPayload = {
      "@context": [
        "https://www.w3.org/2018/credentials/v1",
        "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.2.json"
      ],
      type: [
        "VerifiableCredential",
        "OpenBadgeCredential"
      ],
      issuer: {
        id: issuer_id,
        name: display.name,
        description: display.description,
      },
      name: credentialDisplay?.name || '',
      description: credentialDisplay?.description || '',

      // We add the new and the old, deprecated fields
      validFrom,
      issuanceDate: validFrom,
      validUntil,
      expirationDate: validUntil,

      credentialSubject: {
        type: badgeTypes,
        achievement
      },
    }
    debug(`credential ${JSON.stringify(credential)}`);

    return {
      format: 'jwt_vc_json',
      credential,
    };
  }
}
