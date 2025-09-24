import passport from 'passport';
import { Strategy } from 'passport-http-bearer';
import express, { Express } from 'express'
import { listIdentifiers, storeIdentifier, deleteIdentifier, createIdentifier } from './identifiers.js';
import { createIssuer, deleteIssuer, getIssuer, listIssuers, storeIssuer } from './issuers.js';
import { createCredential, deleteCredential, listCredentials, storeCredential } from './credentials.js';

function bearerAdminForAPI() {
    passport.use('admin-api', new Strategy(
        function (token:string, done:Function) {
            if (token == process.env.BEARER_TOKEN) {
                return done(null, true);
            }
            return done(null, false);
        }
    ));
}

export async function createRoutesForAdmin(app:Express) {
    const router = express.Router();
    app.use('/api', router);
    bearerAdminForAPI();

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
    router.post('/credentials', 
        passport.authenticate('admin-api', { session: false }),
        storeCredential
    );
    router.delete('/credentials', 
        passport.authenticate('admin-api', { session: false }),
        deleteCredential
    );
    router.put('/credentials', 
        passport.authenticate('admin-api', { session: false }),
        createCredential
    );

    router.get('/issuers', 
        passport.authenticate('admin-api', { session: false }),
        listIssuers
    );
    router.get('/issuers/:id', 
        passport.authenticate('admin-api', { session: false }),
        getIssuer
    );
    router.post('/issuers', 
        passport.authenticate('admin-api', { session: false }),
        storeIssuer
    );
    router.delete('/issuers', 
        passport.authenticate('admin-api', { session: false }),
        deleteIssuer
    );
    router.put('/issuers', 
        passport.authenticate('admin-api', { session: false }),
        createIssuer
    );

}

