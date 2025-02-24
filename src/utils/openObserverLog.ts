import { LOG_SERVICE, LOG_USER } from "environment";
import { debug } from "utils/logger";

export async function openObserverLog(state:string, endpoint: string, data:any)
{
    let message = {
        state,
        endpoint,
        data
    };

    if (LOG_SERVICE === undefined || LOG_USER === undefined) {
        debug("Log server would have recieved:", message);
        return;
    }

    await fetch(LOG_SERVICE, {
        method: 'POST',
        headers: {'Authorization': 'Basic ' + LOG_USER},
        body: JSON.stringify(message)
    });
}
