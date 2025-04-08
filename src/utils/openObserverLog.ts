import Debug from 'debug';
const debug = Debug('issuer:logger');
import { LOG_SERVICE, LOG_USER } from "environment";

export async function openObserverLog(state:string, endpoint: string, data:any)
{
    let message = {
        state,
        endpoint,
        data
    };

    if (LOG_SERVICE === undefined || LOG_USER === undefined) {
        debug("Log server would have received:", message);
        return;
    }

    try {
        await fetch(LOG_SERVICE, {
            method: 'POST',
            headers: {'Authorization': 'Basic ' + LOG_USER},
            body: JSON.stringify(message)
        });
    }
    catch (e) {

    }
}
