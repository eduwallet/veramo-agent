
import { toStringByJoin } from "#root/utils/toStringByJoin";
import { Credential } from '#root/credentials/Credential';
import { CredentialType } from "#root/credentials/types/CredentialType";
import { Session, Credential as DBCredential } from "#root/packages/datastore/index";
import { getDbConnection } from "#root/database/databaseService";
import { StatusListRevocationState } from "#root/types/api";
import moment from "moment";

export class EduID extends CredentialType
{
    private acceptedClaims:string[] = [
            "name",
            "given_name",
            "family_name",
            "email",
            "eduperson_assurance",
            "schac_home_organization",
            "eduperson_scoped_affiliation"
    ];

    // https://wiki.refeds.org/display/STAN/eduPerson+%28202208%29+v4.4.0#eduPerson(202208)v4.4.0-eduPersonAffiliation
    private affiliations:string[] = [
        'faculty', 'student', 'staff', 'alum', 'member', 'affiliate', 'employee', 'library-walk-in'
    ];

    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        this.enrichDataWithUserInfo(credential, session);
        await this.checkHolderkeyReuse(credential, session);
        await this.revokePreviousCredentials(credential);
        credential.data = this.convertDataToClaims(credential.data);
        return true;
    }

    public check(credential:Credential)
    {
        return true;
    }

    private convertDataToClaims(input:any):any {
        var retval:any = {};
        for (const key of Object.keys(input)) {
            if (this.acceptedClaims.includes(key)) {
                switch (key) {
                    case "eduperson_assurance":
                        if (Array.isArray(input[key])) {
                            retval[key] = input[key];
                        }
                        else {
                            retval[key] = toStringByJoin(input[key]);    
                        }
                        break;
                    case "eduperson_scoped_affiliation":
                        {
                            if (Array.isArray(input[key])) {
                                retval[key] = input[key];
                            }
                            else {
                                retval[key] = toStringByJoin(input[key]);
                            }
                            const fieldvalue = toStringByJoin(input[key]);
                            for (const aff of this.affiliations) {
                                retval['is_' + aff] = (fieldvalue.indexOf(aff + '@') >= 0) ? 1 : 0;
                            }
                            break;
                        }
                    default:
                        retval[key] = toStringByJoin(input[key]);
                        break;
                }
            }
        }
        return retval;
    }

    private enrichDataWithUserInfo(credential:Credential, session:Session)
    {
        const data = session.data.accessData;
        if (data && Object.keys(data).length > 0) {
            for (const nm of this.acceptedClaims) {
                if (data[nm]) credential.data[nm] = data[nm];
            }
            console.log('setting principalId to ', data['sub']);
            credential.principalId = toStringByJoin(data['sub']);
        }
    }

    private async checkHolderkeyReuse(credential:Credential, session:Session)
    {
        // a holder key that received a EduID in the past cannot receive a new EduID again
        // UNLESS it is for the same EduID.
        // Or UNLESS the previous EduID has expired. We should clear out expired credentials
        // automatically.
        const uid = credential.principalId;
        if (!uid || uid.length == 0) {
            console.log('uid is ', uid);
            throw new Error("Invalid uid detected, not issuing credential");
        }
        const holderKey = credential.holder;
        if (!holderKey || holderKey.length == 0) {
            throw new Error("Invalid holder key detected");
        }

        let obj =  await this.getCredentialForHolderAndId(holderKey, uid);
        while (obj) {
            // if this holder has an expired credential, we can forget about it.
            // It is allowed to load someone else's eduID if your eduID has expired
            if (this.credentialHasExpired(obj)) {
                await this.deleteCredential(obj);
                obj = await this.getCredentialForHolderAndId(holderKey, uid);
            }
            else {
                // we found a non-expired eduID for this holder and a different uid
                throw new Error("Holder already has a different eduID assigned");
            }
        }
        return true;
    }

    private credentialHasExpired(credential:DBCredential)
    {
        if (credential.expirationDate) {
            const dt = moment(credential.expirationDate);
            if (dt.isBefore(moment())) {
                return true;
            }
        }
        return false;
    }

    private async deleteCredential(credential:DBCredential)
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(DBCredential);
        await repo.createQueryBuilder('credential').delete().where("id=:id", {id: credential.id}).execute();
    }

    private async getCredentialForHolderAndId(holder:string, id:string)
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(DBCredential);
        return await repo.createQueryBuilder('credential').where('holder=:holder and credpid<>:id and "credentialId"=\'eduID\'', {holder, id}).getOne();
    }

    private async revokePreviousCredentials(credential:Credential)
    {
        const uid = credential.principalId;
        if (!uid || uid.length == 0) {
            throw new Error("Invalid uid detected, not issuing credential");
        }
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(DBCredential);
        const objs =  await repo.createQueryBuilder('credential').where('credpid=:id and "credentialId"=\'eduID\'', {id:uid}).getMany();
        if (objs) {
            for(const obj of objs) {
                // revoke it if the credential has changed (so we apparently have a new eduID, which makes all other eduIDs with a different
                // content invalid), or if we issue another eduID to the same holder (in which case it is either different or the same,
                // but the previous one apparently was lost, or at least it duplicates)
                // We expect the wallet to check up on revocation and remove the previous eduID. However, due to there being no spec about
                // comparing credentials, wallets will happily accept issuing several identical eduIDs for the same holder and display
                // all of them in the interface, causing multiple cards to exist (confusing for the user, but he should not have tried
                // receiving another eduID if he already has one).
                if (!this.storedCredentialEqualsNewCredential(credential, obj) || obj.holder == credential.holder) {
                    if (obj.status != StatusListRevocationState.REVOKED) {
                        await this.revokeCredential(credential, obj);
                    }
                }
            }
        }
    }

    private storedCredentialEqualsNewCredential(credential:Credential, db:DBCredential)
    {
        for (const nm of this.acceptedClaims) {
            const v1 = credential.data[nm] ? toStringByJoin(credential.data[nm]) : null;
            const v2 = db.claims[nm] ?? null;

            if (!  (  (v1 === null && v2 === null)
                   || (typeof(v1) === typeof(v2)
                       && v1 === v2
                       )
                    )
                )
            {
                // claims do not match
                return false;
            }
        }
        return true;
    }

    private async revokeCredential(credential:Credential, db:DBCredential)
    {
        // if there is a status list associated with the credential, revoke it
        if (db.statuslists && (!Array.isArray(db.statuslists) || db.statuslists.length > 0)) {
            const uuid = db.uuid;
            await credential.issuer!.revokeCredential(uuid, true, null, true);
        }
    }
}
