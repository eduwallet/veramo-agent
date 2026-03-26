import { getDIDConfigurationStore } from "#root/dids/Store";
import { Issuer } from "#root/issuer/Issuer";
import { JWT } from "#root/jwt/JWT";
import { Factory } from "@muisit/cryptokey";
import moment from "moment";

export async function getOIDFedInfo(issuer:Issuer, date?:string) {
  const dids = getDIDConfigurationStore();
  const oidfedkey = await dids.get(process.env.OIDFED_KEY ?? 'oidfed');
  if (!oidfedkey) {
    throw new Error("Missing OIDFed key configuration");
  }

  const jwk = await Factory.toJWK(oidfedkey.key);
  const issuerJWK = await Factory.toJWK(issuer.key!);
  const metadata = issuer.generateMetadata();
  const logouri = metadata.display![0].logo?.uri;
  const jwt = new JWT();
  jwt.header = {
    typ: 'JWT',
    kid: jwk.kid
  };
  jwt.payload = {
    "iss": issuer.options.baseUrl,
    "sub": issuer.options.baseUrl,
    "iat": moment(date).unix(),
    "exp": moment(date).unix() + 300,
    "metadata": {
      "federation_entity": {
        "display_name": issuer.options.name,
        ...(logouri && {"logo_uri": logouri}),
        "organization_name": issuer.options.name,
        "contacts": [process.env.OIDFED_ADMIN_CONTACT]
      },
      "openid_credential_issuer": metadata,
      "vc_issuer": {
        "jwks": [issuerJWK]
      }
    },
    "jwks": [jwk],
    "authority_hints": [process.env.OIDFED_AUTH]
  };

  for (const dpl of metadata.display!) {
    // language tags in the JWT claim follows BCP47 / RFC 5646
    // which should be the same as for the display metadata
    if (dpl.locale && dpl.locale.length) {
        jwt.payload.metadata.federation_entity['display_name#' + dpl.locale] = dpl.name!;
        jwt.payload.metadata.federation_entity['organization_name#' + dpl.locale] = dpl.name!;
    }
  }
  await jwt.sign(issuer.key!, issuer.algorithm());
  return jwt.token;
}
