import passport from 'passport';
import { Strategy } from 'passport-http-bearer';
import express, { Express } from 'express'
import { listIdentifiers, storeIdentifier, deleteIdentifier, createIdentifier } from './identifiers.js';
import { getIssuer, listIssuers } from './issuers.js';
import { getCredential, listCredentials } from './credentials.js';
import { getContextDocument, listContextDocuments } from './contexts.js';
import { getVCT, listVCTs } from './vcts.js';
import { adminBearerToken, hasAdminBearerToken } from '#root/utils/adminBearerToken';
import { getVersion } from './getVersion.js';
import { exportConfig } from './exportConfig.js';
import { adminAuthRateLimiter } from '#root/server/rateLimiters';

type PassportCallback = (err:any, res:boolean) => void;

function bearerAdminForAPI() {
    passport.use('admin-api', new Strategy(
        function (token:string, done:PassportCallback) {
            if (token == adminBearerToken()) {
                return done(null, true);
            }
            return done(null, false);
        }
    ));
}

export async function createRoutesForAdmin(app:Express) {
    const router = express.Router();
    app.use('/api', router);
    router.get('/version', getVersion);

    // no BEARER_TOKEN means no administration api
    if (!hasAdminBearerToken()) {
        return;
    }

    bearerAdminForAPI();

    // applies to every route registered below this point (all bearer-protected admin
    // routes), but not to the public /version route registered above it
    router.use(adminAuthRateLimiter);

    router.get('/exit',
        passport.authenticate('admin-api', { session: false }),
        () => {
            setTimeout(() => { process.exit(0)}, 2000);
        }
    );
    router.get('/export',
        passport.authenticate('admin-api', { session: false }),
        exportConfig
    )

    router.get('/identifiers', 
        passport.authenticate('admin-api', { session: false }),
        listIdentifiers
    );
    router.post('/identifiers', 
        passport.authenticate('admin-api', { session: false }),
        storeIdentifier
    );
    router.delete('/identifiers', 
        passport.authenticate('admin-api', { session: false }),
        deleteIdentifier
    );
    router.put('/identifiers', 
        passport.authenticate('admin-api', { session: false }),
        createIdentifier
    );

    router.get('/credentials',
        passport.authenticate('admin-api', { session: false }),
        listCredentials
    );
    router.get('/credentials/:id',
        passport.authenticate('admin-api', { session: false }),
        getCredential
    );

    router.get('/contexts',
        passport.authenticate('admin-api', { session: false }),
        listContextDocuments
    );
    router.get('/contexts/:id',
        passport.authenticate('admin-api', { session: false }),
        getContextDocument
    );

    router.get('/vcts',
        passport.authenticate('admin-api', { session: false }),
        listVCTs
    );
    router.get('/vcts/:id',
        passport.authenticate('admin-api', { session: false }),
        getVCT
    );

    router.get('/issuers',
        passport.authenticate('admin-api', { session: false }),
        listIssuers
    );
    router.get('/issuers/:id',
        passport.authenticate('admin-api', { session: false }),
        getIssuer
    );

}
