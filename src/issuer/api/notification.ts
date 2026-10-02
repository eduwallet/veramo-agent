import Debug from 'debug';
const debug = Debug('issuer:api');
import { Request } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { ApiState } from '#root/types/internal';
import { NotificationEvent, NotificationRequest } from '#root/types/specification/notification_request';
import { extractBearerToken } from '#root/issuer/api/validateCredentialRequest';
import { verifyAccessTokenJWT } from '#root/issuer/lib/verifyAccessTokenJWT';

const VALID_EVENTS = Object.values(NotificationEvent) as string[];

export async function validateNotificationRequest(issuer:Issuer, request:Request): Promise<ApiState>
{
    debug("validating notification request", request.body);
    const error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};

    const jwt = extractBearerToken(request.header('Authorization'));
    if (!jwt) {
        debug("invalid because the bearer/DPoP token is not present");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Unauthorized";
        return error;
    }

    let session = null;
    try {
        const data = await verifyAccessTokenJWT(jwt, issuer);
        const stateid = data?.payload?.issuer_state;
        session = await issuer.getSessionByState(stateid);
    }
    catch (e) {
        debug("caught error on access token validation", e);
        console.error("Caught exception on validating access token", e);
    }

    if (!session) {
        debug("invalid because session could not be found");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Unauthorized";
        return error;
    }

    const notificationRequest:NotificationRequest = request.body;

    // the notification_id is required to be the value previously returned in the credential
    // response; for our implementation, this is the session's uuid
    if (!notificationRequest.notification_id || notificationRequest.notification_id !== session.uuid) {
        debug("invalid because the notification_id does not match the session", notificationRequest.notification_id);
        error.error = ErrorCodes.INVALID_NOTIFICATION_ID;
        error.description = "Invalid notification_id";
        return error;
    }

    if (!notificationRequest.event || !VALID_EVENTS.includes(notificationRequest.event)) {
        debug("invalid because the event is missing or unsupported", notificationRequest.event);
        error.error = ErrorCodes.INVALID_NOTIFICATION_REQUEST;
        error.description = "Invalid or missing event";
        return error;
    }

    error.data = { session, notificationRequest };
    debug("notification request is valid");
    return error;
}
