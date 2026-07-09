import { Router, Request, Response } from 'express';
import passport from 'passport';
import { StatusListType } from 'statusLists/StatusListType';

interface RevokeRequest {
    list:string;
    index:number;
    status:string;
}

interface RevokeResponse {
    status:string;
}

/* Adjust the bit value for a specific bit in the bitstring lists
 *
 * The list parameter refers to the full credential URL of the bitstring credential. We
 * need to parse this to find the proper status list number.
 * The status list name should match that of the bitstring credential.
 * 
 * If the requested state is already the current state, we return UNCHANGED as state value.
 */
export function revokeIndex(statusList:StatusListType, router:Router) {
    router!.post('/api/revoke',
        passport.authenticate(statusList.name + '-admin', { session: false }),
        async (request: Request<RevokeRequest>, response: Response<RevokeResponse>) => {
            try {
                const shouldStartWith = statusList.createCredentialUrl();
                if (!request.body.list.startsWith(shouldStartWith)) {
                    throw new Error("Incorrect list combination");
                }
                const listIndex = parseInt(request.body.list.substring(shouldStartWith.length));
                const list = await statusList.get(listIndex); // throws an exception if not found               
                const revokeState = await statusList.revoke(list, parseInt(request.body.index), request.body.status == 'revoke');
                response.status(200).end(JSON.stringify({status:revokeState}));
            } catch {
                response.status(404).end('List not found');
            }
        });
}