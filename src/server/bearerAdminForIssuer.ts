import passport from 'passport';
import { Strategy } from 'passport-http-bearer';
import { Issuer } from 'issuer/Issuer';

export function bearerAdminForIssuer(issuer:Issuer) {
    passport.use(issuer.name + '-admin', new Strategy(
        function (token:string, done:Function) {
            if (token == issuer.options.adminToken) {
                return done(null, issuer);
            }
            return done(null, false);
        }
    ));
}
