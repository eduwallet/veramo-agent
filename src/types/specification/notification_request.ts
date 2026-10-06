// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-notification-endpoint

export enum NotificationEvent {
    CREDENTIAL_ACCEPTED = 'credential_accepted',
    CREDENTIAL_FAILURE = 'credential_failure',
    CREDENTIAL_DELETED = 'credential_deleted',
}

export interface NotificationRequest {
    notification_id: string;
    event: NotificationEvent;
    event_description?: string;
}
