import { CredentialDataSupplierArgs, CredentialDataSupplierResult } from "@sphereon/oid4vci-issuer";
import { ICredential } from "@sphereon/ssi-types"
import { Issuer } from "issuer/Issuer";
import { BaseCredential } from "./BaseCredential";
import { debug } from "utils/logger";

export interface DisplayConfiguration {
  name: string;
  description: string;
}

export interface CredentialConfiguration {
  display: DisplayConfiguration[];
  getFirstDisplay: () => DisplayConfiguration;
}

const defaultConfiguration: CredentialConfiguration = {
  display: [{
    name: '',
    description: '',
  }],

  getFirstDisplay: function() {
    return this.display[0];
  },
};

// the issuer.getCredentialConfiguration has a return type of CredentialConfiguration | null
// which makes it hard to use. We ensure that we always have a configuration object to work with
function getCredentialConfiguration(issuer: Issuer, credentialId: string): CredentialConfiguration {
  const config = issuer.getCredentialConfiguration(credentialId) || {};

  return {
    ...defaultConfiguration,
    ...config,
  };
}

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

  public async generate(args: CredentialDataSupplierArgs): Promise<CredentialDataSupplierResult> {
    debug('OpenBadgeCredential.generate()', args);

    const display = (this.issuer.metadata.metadata.display ?? [{}])[0];
    const credentialConfiguration = getCredentialConfiguration(this.issuer, 'OpenBadgeCredential');
    const credentialDisplay = credentialConfiguration.getFirstDisplay();

    const achievement = args?.credentialDataSupplierInput?.credential?.credentialSubject?.achievement ?? {};
    debug('achievement', achievement);

    const validFrom: string = args?.credentialDataSupplierInput?.credential?.validFrom;
    const validUntil: string | undefined = args?.credentialDataSupplierInput?.credential?.validUntil;

    // TODO: Can the did ever be null? The sphereon types allow it, but it seems this
    // would not be a valid state in our actual badge and issuer setup. Probably
    // replace the Sphereon Issue type with a more specific one.
    const issuer_id = this.issuer.did?.did || '';

    const badgeTypes = [
      CredentialType.VerifiableCredential,
      CredentialType.OpenBadgeCredential,
    ];

    // See https://www.imsglobal.org/spec/ob/v3p0/#org.1edtech.ob.v3p0.achievementcredential.class
    const credential: ICredential = {
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
      name: credentialDisplay.name,
      description: credentialDisplay.description,

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
