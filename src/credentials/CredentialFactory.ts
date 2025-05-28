import { Credential } from "./Credential";
import { CredentialType } from "./types/CredentialType";
import { AcademicBaseCredential } from "./types/AcademicBaseCredential";
import { AcademicEnrollmentCredential } from "./types/AcademicEnrollmentCredential";
import { PID } from "./types/PID";
import { OpenBadgeCredential } from "./types/OpenBadgeCredential";
import { GenericCredential } from "./types/GenericCredential";
import { SDJWT } from "./formats/SDJWT";
import { VCDM } from "./formats/VCDM";

export class CredentialFactory
{
    private static createInstance(credential:Credential):CredentialType|null
    {
        switch (credential.type) {
            case 'AcademicBaseCredential':
                return new AcademicBaseCredential();
            case 'AcademicEnrollmentCredential':
                return new AcademicEnrollmentCredential();
            case 'PID':
                return new PID();
            case 'OpenBadgeCredential':
                return new OpenBadgeCredential();
            default:
            case 'GenericCredential':
                return new GenericCredential();
        }
    }

    public static check(credential:Credential)
    {
        const instance = this.createInstance(credential);

        if (instance && credential.data && credential.issuer) {
            return instance.check(this);
        }
        return false;
    }

    public static async resolve(credential:Credential)
    {
        await credential.resolve();
        const instance = this.createInstance(credential);

        if (instance && credential.data && credential.issuer) {
            await instance.resolve(this);
        }
        return true;
    }

    public static async sign(credential:Credential)
    {
        switch (credential.configuration.format) {
            case 'dc+sd-jwt':
            case 'vc+sd-jwt':
                const sdjwt = new SDJWT(credential, credential.configuration.format);
                await sdjwt.sign();
            case 'jwt_vc_json':
            case 'vc+jwt':
                const vcjwt = new VCDM(credential, credential.configuration.format);
                await vcjwt.sign();
                
        }
        return true;
    }
}

