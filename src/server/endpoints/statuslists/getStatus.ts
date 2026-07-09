import { Router, Request, Response } from 'express';
import passport from 'passport';
import { StatusListType } from 'statusLists/StatusListType';


/* Request a new index from the indicated statuslist type
 *
 * A new index is determined. If the previous revision of this statuslist type was considered
 * full, a new statuslist is created.
 * This also returns a specific revoke URL, which would actually work as a toggle-url
 * and a status url to retrieve the specific status of this index
 */
export function getStatus(statusList:StatusListType, router:Router) {
    router!.get('/api/status/:listindex/:credindex',
        passport.authenticate(statusList.name + '-admin', { session: false }),
        async (request: Request, response: Response) => {
            try {
                const list = await statusList.get(parseInt(request.params.listindex as string));
                const state = await statusList.getState(list, parseInt(request.params.credindex as string));
                if ((list.bitsize ?? 1) == 1) {
                    if (state) {
                        response.status(200).end(JSON.stringify({"status":true}));
                    }
                    else {
                        response.status(200).end(JSON.stringify({"status":false}));
                    }
                }
                else {
                    response.status(200).end(JSON.stringify({"status":state}));
                }
            } catch {
                response.status(404).end('List not found');
            }
        });
}