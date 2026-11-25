import { Issuer } from '#root/issuer/Issuer';
import { AuthorizationServerSelectionError } from '#root/issuer/lib/AuthorizationServerSelectionError';

/**
 * Checks that the issuer has an authorization server for the grants of a credential offer.
 * Returns the error description, or null when the offer can be created
 */
export function checkAuthorizationServers(issuer:Issuer, authorizationCode:boolean, preAuthorizedCode:boolean, presentation:boolean):string|null
{
    try {
        if (authorizationCode) {
            issuer.authorizationServerFor('authorization_code', presentation);
        }
        if (preAuthorizedCode) {
            issuer.authorizationServerFor('pre-authorized_code', false);
        }
    }
    catch (e) {
        if (e instanceof AuthorizationServerSelectionError) {
            return e.message;
        }
        throw e;
    }
    return null;
}
