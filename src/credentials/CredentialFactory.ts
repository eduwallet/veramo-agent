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
import { getClaimDefinitions } from "#root/issuer/lib/claimDefinitions";

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
            debug('copying claims from their configured origins');
            instance.copyClaimsFromOrigin(credential, session.data.accessData);
            debug('resolving credential instance');
            await instance.resolve(credential, session);
        }
        debug('end of credential resolving');
        return true;
    }

    /**
     * Determine the claims of the credential from their configured origins and check the result:
     * mandatory claims must be present, typed claims must have the correct type, and the credential
     * type must accept the data. The credential data is not changed.
     * Returns a list of errors, which is empty if the credential data is valid.
     */
    public static validateClaims(credential:Credential, accessData:any):string[]
    {
        const instance = this.createInstance(credential);
        if (!instance) {
            return ['Unknown credential type'];
        }

        const errors:string[] = [];
        // work on a copy of the data, copying the claims changes the data
        const copy = new Credential();
        Object.assign(copy, credential);
        copy.data = structuredClone(credential.data ?? {});
        instance.copyClaimsFromOrigin(copy, accessData);

        for (const definition of getClaimDefinitions(credential.configuration)) {
            const target = (definition.path.length > 1 && definition.path[0] == 'credentialSubject') ? definition.path.slice(1) : definition.path;
            const name = target.join('.');
            const value = instance.getAttributeFromPath(copy.data, target);
            const present = typeof(value) != 'undefined' && value !== null && value !== '';
            if (!present) {
                if (definition.mandatory) {
                    errors.push(`Missing mandatory claim '${name}'`);
                }
                continue;
            }
            if (!this.hasValueType(value, definition.type)) {
                errors.push(`Claim '${name}' must be of type ${definition.type}`);
            }
        }

        if (errors.length == 0 && !instance.check(copy)) {
            errors.push('The credential data is not accepted for this credential type');
        }
        return errors;
    }

    private static hasValueType(value:any, type:string|null):boolean
    {
        switch (type) {
            case 'string': return typeof(value) == 'string';
            case 'number': return typeof(value) == 'number';
            case 'integer': return Number.isInteger(value);
            case 'boolean': return typeof(value) == 'boolean';
            case 'array': return Array.isArray(value);
            case 'object': return typeof(value) == 'object' && !Array.isArray(value);
            default: return true; // unknown or unrestricted types
        }
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
                    let baseCredential = await cred.build();
                    if (credential.format == 'jwt_vc_json-ld') {
                        // sign the whole {vc: ...} envelope: the proof must end up
                        // as a sibling of the vc subclaim, not nested inside it
                        baseCredential = await JSONLD.sign(credential, baseCredential);
                    }
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
                    // sign the whole {vc: ...} envelope: the proof must end up
                    // as a sibling of the vc subclaim, not nested inside it
                    const ld = await JSONLD.sign(credential, await vcdm.build());
                    credential.output = ld;
                    break;
                }
        }
        return true;
    }
}

