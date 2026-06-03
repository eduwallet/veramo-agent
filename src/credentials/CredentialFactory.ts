import Debug from 'debug';
const debug = Debug('issuer:credential');

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
import { EduID } from "./types/EduID.js";
import { Session } from "#root/database/entities/index";
import { EduIDEntitlement } from "./types/EduIDEntitlement.js";
import { W3C } from "./formats/W3C.js";

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
            case 'eduID':
                return new EduID();
            case 'entitlement':
                return new EduIDEntitlement();
            default:
            case 'GenericCredential':
                return new GenericCredential();
        }
    }

    public static check(credential:Credential)
    {
        const instance = this.createInstance(credential);

        if (instance && credential.issuer) {
            return instance.check(credential);
        }
        return false;
    }

    public static async resolve(credential:Credential, session:Session)
    {
        debug('resolving constitution of credential');
        await credential.resolve();
        debug('creating instance of credential', credential.type);
        const instance = this.createInstance(credential);

        if (instance && (credential.data || credential.presetCredential || credential.callback) && credential.issuer) {
            debug('retrieving external credential if callback is available');
            await instance.retrieveExternalCredential(credential, session);
            debug('resolving credential instance');
            await instance.resolve(credential, session);
        }
        debug('end of credential resolving');
        return true;
    }

    public static async sign(credential:Credential)
    {
        switch ((credential.format || '') as string) {
            case 'dc+sd-jwt':
            case 'vc+sd-jwt':
                {
                    const sdjwt = new SDJWT(credential, credential.format);
                    await sdjwt.build();
                    await sdjwt.sign();
                    break;
                }
            case 'jwt_vc_json':
            case 'jwt_vc_json-ld':
                // this is a VCDM1.1 credential as a JWT format, with or without LDP
                {
                    const cred = new W3C(credential);
                    const baseCredential = await cred.build();
                    const jose = new JOSE(credential, baseCredential, credential.format);
                    await jose.sign();
                    break;
                }
            case 'vc+jwt':
                // this is a VCDM2.0 credential as a JWT format
                {
                    const cred = new VCDM(credential);
                    const baseCredential = await cred.build();
                    const jose = new JOSE(credential, baseCredential, credential.format);
                    await jose.sign();
                    break;
                }
            case 'ldp_vc':
                // this is a non-jwt encoded VCDM 1.1 credential with LDP
                {
                    const vcdm = new W3C(credential);
                    const ld = await JSONLD.sign(credential, await vcdm.build());
                    credential.output = ld;
                    break;
                }
        }
        return true;
    }
}

