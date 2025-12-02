export enum StatusListRevocationState {
    UNKNOWN = 'UNKNOWN',
    REVOKED = 'REVOKED',
    WAS_REVOKED = 'WAS_REVOKED',
    UNREVOKED = 'UNREVOKED',
    WAS_UNREVOKED = 'WAS_UNREVOKED'
}

export enum ErrorCodes {
    NO_ERROR = "no error",
    INVALID_REQUEST = "invalid_request", // specified by the spec
    INTERNAL_ERROR = "internal error",
    NOT_IMPLEMENTED = "not implemented",
    EXPIRED = "expired",
    INVALID_CREDENTIAL_REQUEST = "invalid_credential_request",
    UNSUPPORTED_CREDENTIAL_TYPE = "unsupported_credential_type",
    UNSUPPORTED_CREDENTIAL_FORMAT = "unsupported_credential_format",
    INVALID_PROOF = "invalid_proof",
    INVALID_NONCE = "invalid_nonce",
    INVALID_ENCRYPTION_PARAMETERS = "invalid_encryption_parameters",
    CREDENTIAL_REQUEST_DENIED = "credential_request_denied"
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
  