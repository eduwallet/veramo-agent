import { Issuer } from 'issuer/Issuer';
import { CredentialDataSupplierInput } from '@sphereon/oid4vci-common'
import { AcademicBaseCredential } from './AcademicBaseCredential';
import { PID } from './PID';

export function credentialDataChecker(issuer:Issuer, credentialId:string, claims: CredentialDataSupplierInput): boolean {
    switch (credentialId) {
        case 'AcademicBaseCredential':
            const abc = new AcademicBaseCredential(issuer);
            return abc.check(claims);
        case 'PID':
            const pid = new PID(issuer);
            return pid.check(claims);
    }
    return false;
}
