import { Issuer } from 'issuer/Issuer';
import { getTypesFromRequest } from '@sphereon/oid4vci-common'
import { CredentialDataSupplierArgs, CredentialDataSupplierResult} from "@sphereon/oid4vci-issuer";
import { AcademicBaseCredential } from './AcademicBaseCredential';
import { PID } from './PID';
import { OpenBadgeCredential } from './OpenBadgeCredential';
import { debug } from 'utils/logger';
import { GenericCredential } from './GenericCredential';
import { AcademicEnrollmentCredential } from './AcademicEnrollmentCredential';
import { getCredentialTypeFromConfig } from 'utils/getCredentialTypeFromConfig';

export function credentialResolver(issuer:Issuer) {
    return async (args:CredentialDataSupplierArgs):Promise<CredentialDataSupplierResult> => {
        debug('credentialResolver().()', args);

        const stateId = args.preAuthorizedCode || args.issuerState || '';
        var sessionState = await issuer.getSessionById(stateId);
        const credentialId = sessionState.principalCredentialId;
        const credentialConfiguration = issuer.getCredentialConfiguration(credentialId!);
        const credentialTypes = getCredentialTypeFromConfig(credentialConfiguration!); 
        // only support single credential names here
        switch (credentialTypes[0]) {
            case 'AcademicBaseCredential':
                const abc = new AcademicBaseCredential(issuer, credentialId!);
                return abc.generate(args);
            case 'AcademicEnrollmentCredential':
                const aec = new AcademicEnrollmentCredential(issuer, credentialId!);
                return aec.generate(args);
            case 'PID':
                const pid = new PID(issuer, credentialId!);
                return pid.generate(args);
            case 'OpenBadgeCredential':
                const openBadgeCredential = new OpenBadgeCredential(issuer, credentialId!);
                return openBadgeCredential.generate(args);
            default:
            case 'GenericCredential':
                const genericCredential = new GenericCredential(issuer, credentialId!);
                return genericCredential.generate(args);
        }
    }
}
