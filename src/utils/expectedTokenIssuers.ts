import { Session } from '#root/database/entities/index';

/**
 * The authorization servers that the credential offer of a session names in its grants. The access token of the
 * session has to be issued by one of these, so a token of another authorization server (for example the external
 * one, for a presentation during issuance offer) is not accepted. A session without a named
 * authorization server accepts no token at all.
 */
export function expectedTokenIssuers(session?: Session | null): string[]
{
    const grants = session?.data?.credentialOffer?.grants ?? {};
    return Object.values(grants)
        .map((grant:any) => grant?.authorization_server)
        .filter((as): as is string => typeof as === 'string' && as.length > 0);
}
