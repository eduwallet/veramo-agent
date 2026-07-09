import { Router, Request, Response } from 'express';
import passport from 'passport';
import { StatusListType } from 'statusLists/StatusListType';

interface StatusRequest {
    list:string;
    index:number;
    status:number;
    mask:number;
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
export function setStatus(statusList:StatusListType, router:Router) {
    router!.post('/api/status',
        passport.authenticate(statusList.name + '-admin', { session: false }),
        async (request: Request<StatusRequest>, response: Response<RevokeResponse>) => {
            try {
                const shouldStartWith = statusList.createCredentialUrl();
                if (!request.body.list.startsWith(shouldStartWith)) {
                    throw new Error("Incorrect list combination");
                }
                const listIndex = parseInt(request.body.list.substring(shouldStartWith.length));
                const list = await statusList.get(listIndex); // throws an exception if not found               
                const mask = request.body.mask ? parseInt(request.body.mask) : -1;
                const revokeState = await statusList.setState(list, parseInt(request.body.index), parseInt(request.body.status), mask);
                response.status(200).end(JSON.stringify({status:revokeState}));
            } catch {
                response.status(404).end('List not found');
            }
        });
}