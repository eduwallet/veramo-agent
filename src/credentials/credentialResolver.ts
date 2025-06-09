import Debug from 'debug';
const debug = Debug('issuer:credentials');
import { Issuer } from 'issuer/Issuer.js';
import { AcademicBaseCredential } from './AcademicBaseCredential.js';
import { PID } from './PID.js';
import { OpenBadgeCredential } from './OpenBadgeCredential.js';
import { GenericCredential } from './GenericCredential.js';
import { AcademicEnrollmentCredential } from './AcademicEnrollmentCredential.js';
import { getCredentialTypeFromConfig } from 'utils/getCredentialTypeFromConfig.js';
import { CredentialProofData, CredentialResult } from 'types/internal.js';

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
