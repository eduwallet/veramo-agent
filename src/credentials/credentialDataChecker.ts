import { Issuer } from 'issuer/Issuer.js';
import { AcademicBaseCredential } from './AcademicBaseCredential.js';
import { PID } from './PID.js';
import { OpenBadgeCredential } from './OpenBadgeCredential.js';
import { GenericCredential } from './GenericCredential.js';
import { AcademicEnrollmentCredential } from './AcademicEnrollmentCredential.js';
import { getCredentialTypeFromConfig } from 'utils/getCredentialTypeFromConfig.js';

export function credentialDataChecker(issuer:Issuer, credentialId:string, claims: any): boolean {
    const credentialConfiguration = issuer.getCredentialConfiguration(credentialId);
    const credentialType = getCredentialTypeFromConfig(credentialConfiguration!); 

    switch (credentialType) {
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
        default:
        case 'GenericCredential':
            const genericCredential = new GenericCredential(issuer, credentialId);
            return genericCredential.check(claims);
    }
}
