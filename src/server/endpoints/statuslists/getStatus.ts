import { Issuer } from '#root/issuer/Issuer';
import { StatusListType } from '#root/statusLists/StatusListType';
import { StatusListOptions } from '#root/types/internal/statuslists';
import { Request, Response } from 'express';
import passport from 'passport';


/* Request a new index from the indicated statuslist type
 *
 * A new index is determined. If the previous revision of this statuslist type was considered
 * full, a new statuslist is created.
 * This also returns a specific revoke URL, which would actually work as a toggle-url
 * and a status url to retrieve the specific status of this index
 */
export function getStatus(issuer:Issuer, statusListOptions:StatusListOptions, path:string) {
    issuer.router!.get(
        path + "/:listindex/:credindex",
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request, response: Response) => {
            try {
                const statusList = new StatusListType(statusListOptions, issuer);
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