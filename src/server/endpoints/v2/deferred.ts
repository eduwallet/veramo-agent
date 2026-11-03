import { Request, Response } from 'express'
import passport from 'passport';
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { ApiResult, getDeferredTransaction, listDeferredTransactions, updateDeferredTransaction } from '#root/issuer/api/v2/deferredTransactions';

async function respond(response:Response, action:() => Promise<ApiResult>)
{
    try {
        const result = await action();
        return response.status(result.status).json(result.body);
    }
    catch (e) {
        return sendErrorResponse(response, 500, {
                error: ErrorCodes.INTERNAL_ERROR,
                error_description: "Internal server error",
            },
            e
        );
    }
}

/**
 * Back-office API for deferred credentials, all under the v2 path:
 *   GET  <path>      list the open transactions
 *   GET  <path>/:id  details of a transaction
 *   POST <path>/:id  supply the claims and release the credential, or deny it
 */
export function deferredTransactions(issuer:Issuer, path:string)
{
    const auth = passport.authenticate(issuer.name + '-admin', { session: false });

    issuer.router!.get(path, auth, (request:Request, response:Response) =>
        respond(response, () => listDeferredTransactions(issuer, typeof(request.query.status) == 'string' ? request.query.status : undefined))
    );
    issuer.router!.get(path + '/:id', auth, (request:Request, response:Response) =>
        respond(response, () => getDeferredTransaction(issuer, request.params.id as string))
    );
    issuer.router!.post(path + '/:id', auth, (request:Request, response:Response) =>
        respond(response, () => updateDeferredTransaction(issuer, request.params.id as string, request.body))
    );
}
