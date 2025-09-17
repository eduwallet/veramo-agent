import { Credential } from "#root/credentials/Credential";
import { CredentialType } from "#root/credentials/types/CredentialType";
import { AcademicBaseCredential } from "#root/credentials/types/AcademicBaseCredential";
import { AcademicEnrollmentCredential } from "#root/credentials/types/AcademicEnrollmentCredential";
import { PID } from "#root/credentials/types/PID";
import { OpenBadgeCredential } from "#root/credentials/types/OpenBadgeCredential";
import { GenericCredential } from "#root/credentials/types/GenericCredential";
import { SDJWT } from "#root/credentials/formats/SDJWT";
import { JOSE } from "#root/credentials/formats/JOSE";
import { JSONLD } from "./formats/JSONLD.js";
import { VCDM } from "./formats/VCDM.js";

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
            return instance.check(credential);
        }
        return false;
    }

    public static async resolve(credential:Credential)
    {
        await credential.resolve();
        const instance = this.createInstance(credential);

        if (instance && credential.data && credential.issuer) {
            await instance.resolve(credential);
        }
        return true;
    }

    public static async sign(credential:Credential)
    {
        switch ((credential.format || '') as string) {
            case 'dc+sd-jwt':
            case 'vc+sd-jwt':
                const sdjwt = new SDJWT(credential, credential.format);
                await sdjwt.sign();
                break;
            case 'jwt_vc_json':
            case 'jwt_vc_json-ld':
            case 'vc+jwt':
                const jose = new JOSE(credential, credential.format);
                await jose.sign();
                break;
            case 'ldp_vc':
                const vcdm = new VCDM(credential);
                const ld = await JSONLD.sign(credential, vcdm.build());
                credential.output = ld;
        }
        return true;
    }
}

