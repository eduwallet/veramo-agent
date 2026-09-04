import { Session } from '#root/database/entities/index';
import { AUTHORIZATION_CODE_GRANT } from '#root/types/specification/credential_offer';

// the issuer metadata can allow both authorization_code and pre-authorized_code flows
// to exist simultaneously, so which one is actually in play for a given credential
// request can only be determined from the grant the session's credential offer was
// created with, not from the issuer's configuration.
export function sessionUsesAuthorisationCodeFlow(session?: Session | null)
{
    return !!session?.data?.credentialOffer?.grants?.[AUTHORIZATION_CODE_GRANT];
}
