import { Issuer } from 'issuer/Issuer';
import { AcademicBaseCredential } from './AcademicBaseCredential';
import { PID } from './PID';
import { OpenBadgeCredential } from './OpenBadgeCredential';
import { debug } from 'utils/logger';
import { GenericCredential } from './GenericCredential';
import { AcademicEnrollmentCredential } from './AcademicEnrollmentCredential';
import { getCredentialTypeFromConfig } from 'utils/getCredentialTypeFromConfig';
import { CredentialProofData, CredentialResult } from 'types/internal';

export async function credentialResolver(issuer:Issuer, proofData:CredentialProofData): Promise<CredentialResult> {
    debug('credentialResolver().()', proofData);
    const { credentialDataSet } = proofData;
    const { credentialId, credentialConfiguration } = credentialDataSet;
    const credentialType = getCredentialTypeFromConfig(credentialConfiguration!); 
    // only support single credential names here
    switch (credentialType) {
        case 'AcademicBaseCredential':
            const abc = new AcademicBaseCredential(issuer, credentialId!);
            return abc.generate(proofData);
        case 'AcademicEnrollmentCredential':
            const aec = new AcademicEnrollmentCredential(issuer, credentialId!);
            return aec.generate(proofData);
        case 'PID':
            const pid = new PID(issuer, credentialId!);
            return pid.generate(proofData);
        case 'OpenBadgeCredential':
            const openBadgeCredential = new OpenBadgeCredential(issuer, credentialId!);
            return openBadgeCredential.generate(proofData);
        default:
        case 'GenericCredential':
            const genericCredential = new GenericCredential(issuer, credentialId!);
            return genericCredential.generate(proofData);
    }
}
