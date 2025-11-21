import passport from 'passport';
import { Strategy } from 'passport-http-bearer';
import express, { Express } from 'express'
import { listIdentifiers, storeIdentifier, deleteIdentifier, createIdentifier } from './identifiers.js';
import { createIssuer, deleteIssuer, getIssuer, listIssuers, storeIssuer } from './issuers.js';
import { createCredential, deleteCredential, listCredentials, storeCredential } from './credentials.js';
import { createContextDocument, deleteContextDocument, listContextDocuments, storeContextDocument } from './contexts.js';
import { createVCTDocument, deleteVCTDocument, listVCTs, storeVCTDocument } from './vcts.js';
import { adminBearerToken, hasAdminBearerToken } from '#root/utils/adminBearerToken';
import { getBuildInfo } from '#root/utils/getBuildInfo';
import { sendErrorResponse } from '../sendErrorResponse.js';
import { ErrorCodes } from '#root/types/api';
import { getVersion } from './getVersion.js';

function bearerAdminForAPI() {
    passport.use('admin-api', new Strategy(
        function (token:string, done:Function) {
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

    router.get('/exit',
        passport.authenticate('admin-api', { session: false }),
        () => {
            setTimeout(() => { process.exit(0)}, 2000);
        }
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

    router.get('/contexts', 
        passport.authenticate('admin-api', { session: false }),
        listContextDocuments
    );
    router.post('/contexts', 
        passport.authenticate('admin-api', { session: false }),
        storeContextDocument
    );
    router.delete('/contexts', 
        passport.authenticate('admin-api', { session: false }),
        deleteContextDocument
    );
    router.put('/contexts', 
        passport.authenticate('admin-api', { session: false }),
        createContextDocument
    );

    router.get('/vcts', 
        passport.authenticate('admin-api', { session: false }),
        listVCTs
    );
    router.post('/vcts', 
        passport.authenticate('admin-api', { session: false }),
        storeVCTDocument
    );
    router.delete('/vcts', 
        passport.authenticate('admin-api', { session: false }),
        deleteVCTDocument
    );
    router.put('/vcts', 
        passport.authenticate('admin-api', { session: false }),
        createVCTDocument
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

