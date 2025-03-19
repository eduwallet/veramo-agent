export { CreateCredentialOfferRequest, CreateCredentialOfferResponse } from './api/credentialOffer';


export enum StatusListRevocationState {
    UNKNOWN = 'UNKNOWN',
    REVOKED = 'REVOKED',
    WAS_REVOKED = 'WAS_REVOKED',
    UNREVOKED = 'UNREVOKED',
    WAS_UNREVOKED = 'WAS_UNREVOKED'
}


export enum ErrorCodes {
    NO_ERROR = "no error",
    INVALID_REQUEST = "invalid request",
    INTERNAL_ERROR = "internal error",
    EXPIRED = "expired",
}

export enum CredentialOfferStatus {
    OFFER_CREATED = 'OFFER_CREATED',
    OFFER_URI_RETRIEVED = 'OFFER_URI_RETRIEVED',
    ACCESS_TOKEN_REQUESTED = 'ACCESS_TOKEN_REQUESTED',
    ACCESS_TOKEN_CREATED = 'ACCESS_TOKEN_CREATED',
    CREDENTIAL_REQUEST_RECEIVED = 'CREDENTIAL_REQUEST_RECEIVED',
    CREDENTIAL_ISSUED = 'CREDENTIAL_ISSUED',
    ERROR = 'ERROR',
}
  