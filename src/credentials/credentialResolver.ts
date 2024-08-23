import { Issuer } from 'issuer/Issuer';
import { getTypesFromRequest } from '@sphereon/oid4vci-common'
import { CredentialDataSupplierArgs, CredentialDataSupplierResult} from "@sphereon/oid4vci-issuer";
import { AcademicBaseCredential } from './AcademicBaseCredential';
import { PID } from './PID';

export function credentialResolver(issuer:Issuer) {
    return async (args:CredentialDataSupplierArgs):Promise<CredentialDataSupplierResult> => {
        const name = getTypesFromRequest(args.credentialRequest, { filterVerifiableCredential: true });
        if (issuer.hasCredential(name)) {
            // only support single credential names here
            switch (name[0]) {
                case 'AcademicBaseCredential':
                    return AcademicBaseCredential(issuer, args);
                case 'PID':
                    return PID(issuer, args);
            }
        }

        // This is an error value to be returned. It will cause a thrown error in the issuer
        // We should never get here, as the requested credential has been checked before
        // to be present and all issuer credentials should have an implementation above
        return ({
            format: '',
            credential: null
        } as unknown) as CredentialDataSupplierResult;

    }
}
