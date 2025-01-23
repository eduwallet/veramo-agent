import { Issuer } from 'issuer/Issuer';
import { CredentialDataSupplierInput } from '@sphereon/oid4vci-common'
import { AcademicBaseCredential } from './AcademicBaseCredential';
import { PID } from './PID';
import { OpenBadgeCredential } from './OpenBadgeCredential';
import { GenericCredential } from './GenericCredential';
import { AcademicEnrollmentCredential } from './AcademicEnrollmentCredential';

export function credentialDataChecker(issuer:Issuer, credentialId:string, claims: CredentialDataSupplierInput): boolean {
    switch (credentialId) {
        case 'AcademicBaseCredential':
            const abc = new AcademicBaseCredential(issuer);
            return abc.check(claims);
        case 'AcademicEnrollmentCredential':
            const aec = new AcademicEnrollmentCredential(issuer);
            return aec.check(claims);
        case 'PID':
            const pid = new PID(issuer);
            return pid.check(claims);
        case 'OpenBadgeCredential':
            const obc = new OpenBadgeCredential(issuer);
            return obc.check(claims);
        case 'GenericCredential':
        case 'GenericCredentialLD':
            const genericCredential = new GenericCredential(issuer);
            return genericCredential.check(claims);
        default:
            throw new Error('Unknown credentialId');
    }
}
