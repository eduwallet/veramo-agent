import { Router, Request, Response } from 'express';
import { StatusListType } from 'statusLists/StatusListType';
import { statusListAsVC } from '../lib/statusListAsVC';
import { statusListAsJWT } from '../lib/statusListAsJWT';
import { StatusListStatus } from 'types';
import moment from 'moment';

export function getCredential(statusList:StatusListType, router:Router) {
    router!.get('/:index',
        async (request: Request, response: Response<string>) => {
            const list = await statusList.get(parseInt(request.params.index as string));
            const status:StatusListStatus = {
                type: statusList,
                statusList: list,
                basepath: statusList.id + '/' + list.index,
                date: moment()
            }
            try {
                let result:any = null;
                switch (statusList.type) {
                    case 'BitstringStatusList':
                    case 'StatusList2020':
                    case 'RevocationList2020':
                    case 'SuspensionList2020':
                    case 'StatusList2021':
                    case 'RevocationList2021':
                    case 'SuspensionList2021':
                        result = await statusListAsVC(status);
                        break;
                    case 'statuslist+jwt':
                        result = await statusListAsJWT(status);
                        break;
                }
                response.setHeader('Content-type', 'application/statuslist+jwt');
                response.send(result);

            } catch {
                response.status(404).end('List not found');
            }
        });
}