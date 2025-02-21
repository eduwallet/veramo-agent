import { Issuer } from 'issuer/Issuer';
import { CredentialDataSupplierInput } from '@sphereon/oid4vci-common'
import { AcademicBaseCredential } from './AcademicBaseCredential';
import { PID } from './PID';
import { OpenBadgeCredential } from './OpenBadgeCredential';
import { GenericCredential } from './GenericCredential';
import { AcademicEnrollmentCredential } from './AcademicEnrollmentCredential';
import { getCredentialTypeFromConfig } from 'utils/getCredentialTypeFromConfig';

export function credentialDataChecker(issuer:Issuer, credentialId:string, claims: CredentialDataSupplierInput): boolean {
    const credentialConfiguration = issuer.getCredentialConfiguration(credentialId);
    const credentialTypes = getCredentialTypeFromConfig(credentialConfiguration!); 

    switch (credentialTypes[0]) {
        case 'AcademicBaseCredential':
            const abc = new AcademicBaseCredential(issuer, credentialId);
            return abc.check(claims);
        case 'AcademicEnrollmentCredential':
            const aec = new AcademicEnrollmentCredential(issuer, credentialId);
            return aec.check(claims);
        case 'PID':
            const pid = new PID(issuer, credentialId);
            return pid.check(claims);
        case 'OpenBadgeCredential':
            const obc = new OpenBadgeCredential(issuer, credentialId);
            return obc.check(claims);
        case 'GenericCredential':
            const genericCredential = new GenericCredential(issuer, credentialId);
            return genericCredential.check(claims);
        default:
            throw new Error('Unknown credentialId');
    }
}
