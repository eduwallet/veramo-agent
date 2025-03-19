import Debug from 'debug';
import { Issuer } from "issuer/Issuer";
import { CreateCredentialOfferRequest, ErrorCodes } from "types/api";
import { ApiState } from "types/internal";
import { PRE_AUTHORIZED_CODE_GRANT } from 'types/specification';

const debug = Debug('api:validate');

export function validateCreateCredentialOffer(issuer:Issuer, request:CreateCredentialOfferRequest):ApiState
{
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};

    debug('validateCreateCredentialOffer to issue credential from', issuer.name, request);
    if (!request.grants || Object.keys(request.grants).length === 0) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No grant specified";
        return error;
    }

    if (!request.credentials) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Missing credentials list";
        return error;
    }

    const credentialConfigIds = request.credentials as string[];
    if (!credentialConfigIds || credentialConfigIds.length === 0) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Missing credential types";
        return error;
    }

    if (!issuer.hasCredentialConfiguration(credentialConfigIds)) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Credential type not supported";
        return error;
    }

    // if pre-authorized-code is used, the proper credential data should be present
    // For this type-check, we use the credential format specification of our configuration, not
    // the credential ID. This allows us to (re)use credential formats with different credential
    // setups (for example: two AcademicBaseCredential's with different branding, or two
    // GenericCredential's with different VC format)        
    if (request.grants[PRE_AUTHORIZED_CODE_GRANT]) {
        if (!issuer.checkCredentialData(credentialConfigIds, request.credentialDataSupplierInput || {})) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Missing required claims";
            return error;
        }
    }
  
    return error;
}