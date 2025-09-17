import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from "#root/issuer/Issuer";
import { ErrorCodes } from '#root/types/api';
import { CreateCredentialOfferRequest } from "#root/types/api/credentialOffer";
import { ApiState } from "#root/types/internal";
import { PRE_AUTHORIZED_CODE_GRANT } from '#root/types/specification/credential_offer';

export function validateCreateCredentialOffer(issuer:Issuer, request:CreateCredentialOfferRequest):ApiState
{
    debug("validating createCredentialOffer", request);
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};

    debug('validateCreateCredentialOffer to issue credential from', issuer.name, request);
    if (!request.grants || Object.keys(request.grants).length === 0) {
        debug("invalid because no grant specified");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No grant specified";
        return error;
    }

    if (!request.credentials) {
        debug("invalid because no credentials requested");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Missing credentials list";
        return error;
    }

    const credentialConfigIds = request.credentials as string[];
    if (!credentialConfigIds || credentialConfigIds.length !== 1) {
        debug("invalid because credentials requested is incorrect", credentialConfigIds);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Missing credential types";
        return error;
    }

    if (!issuer.hasCredentialConfiguration(credentialConfigIds[0])) {
        debug("invalid because requested credential does not exists on issuer");
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
        if (!issuer.checkCredentialData(credentialConfigIds[0], request.credentialDataSupplierInput || {})) {
            debug("invalid because the requested credential data is incorrect", request.credentialDataSupplierInput);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Missing required claims";
            return error;
        }
    }
  
    debug("create credential offer is valid");
    return error;
}