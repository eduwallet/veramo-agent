
import Debug from 'debug';
const debug = Debug('issuer:eduid');
import { toStringByJoin } from "#root/utils/toStringByJoin";
import { Credential } from '#root/credentials/Credential';
import { CredentialType } from "#root/credentials/types/CredentialType";
import { Session, Credential as DBCredential } from "#root/database/entities/index";
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
        debug("resolving eduID credential");
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        debug("enriching data");
        this.enrichDataWithUserInfo(credential, session);
        debug("credential data is ", credential.data);
        debug("checking holder key reuse");
        await this.checkHolderkeyReuse(credential);
        debug("revoking previous");
        await this.revokePreviousCredentials(credential);
        credential.data = this.convertDataToClaims(credential.data);
        debug("credential data is ", credential.data);
        return true;
    }

    public check()
    {
        return true;
    }

    private convertDataToClaims(input:any):any {
        const retval:any = {};
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
        debug("enriching data with user info ", session.data.accessData);
        const data = session.data.accessData;
        this.copyClaimsFromOrigin(credential, data);
        if (credential.data.sub) {
            credential.principalId = toStringByJoin(credential.data.sub);
            delete credential.data.sub;
        }
    }

    private async checkHolderkeyReuse(credential:Credential)
    {
        // a holder key that received a EduID in the past cannot receive a new EduID again
        // UNLESS it is for the same EduID.
        // Or UNLESS the previous EduID has expired. We should clear out expired credentials
        // automatically.
        const uid = credential.principalId;
        debug('checking holder key reuse for eduID', uid);
        if (!uid || uid.length == 0) {
            debug("invalid eduID", uid);
            throw new Error("Invalid uid detected, not issuing credential");
        }
        const holderKey = credential.holder;

        // the holderKey.did value is a reinterpretation of the key material as keytype : public-key-hex
        // This allows us to find previous keys no matter if their representation has changed
        if (!holderKey || !holderKey.did || holderKey.did.length == 0) {
            debug("invalid holder key, missing did", holderKey);
            throw new Error("Invalid holder key detected");
        }

        // loop over all credentials issued for this holder and eduID
        // They are either expired, in which case we can remove them, or
        // they cause an error. If we have removed all expired credentials
        // and nothing remains, we can issue a new credential
        debug("looking for credentials for this holder and id");
        let obj =  await this.getCredentialForHolderAndId(holderKey.did, uid);
        while (obj) {
            debug("found record", obj);
            // if this holder has an expired credential, we can forget about it.
            // It is allowed to load someone else's eduID if your eduID has expired
            if (this.credentialHasExpired(obj)) {
                debug("previous eduID has expired, removing and looking for the next");
                await this.deleteCredential(obj);
                obj = await this.getCredentialForHolderAndId(holderKey.did, uid);
            }
            else {
                // we found a non-expired eduID for this holder and a different uid
                debug("this holder key already has an eduID issued", holderKey.did, uid);
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
        debug("revoking previous eduID credential");
        const uid = credential.principalId;
        if (!uid || uid.length == 0) {
            throw new Error("Invalid uid detected, not issuing credential");
        }
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(DBCredential);
        const objs = await repo.createQueryBuilder('credential').where('status=\'ISSUED\' and credpid=:id and "credentialId"=\'eduID\'', {id:uid}).getMany();
        if (objs) {
            debug("found credentials", objs.length);
            for(const obj of objs) {
                // revoke it if the credential has changed (so we apparently have a new eduID, which makes all other eduIDs with a different
                // content invalid), or if we issue another eduID to the same holder (in which case it is either different or the same,
                // but the previous one apparently was lost, or at least it duplicates)
                // We expect the wallet to check up on revocation and remove the previous eduID. However, due to there being no spec about
                // comparing credentials, wallets will happily accept issuing several identical eduIDs for the same holder and display
                // all of them in the interface, causing multiple cards to exist (confusing for the user, but he should not have tried
                // receiving another eduID if he already has one).
                debug("checking holder keys", obj.holder, credential.holder?.did);
                if (!this.storedCredentialEqualsNewCredential(credential, obj) || obj.holder == credential.holder?.did) {
                    if (obj.status != StatusListRevocationState.REVOKED) {
                        debug("revoking previously unrevoked eduID credential");
                        await this.revokeCredential(credential, obj);
                    }
                    else {
                        debug("previous eduID was already revoked");
                    }
                }
            }
        }
    }

    private storedCredentialEqualsNewCredential(credential:Credential, db:DBCredential)
    {
        for (const nm of this.acceptedClaims) {
            const v1 = credential.data[nm] ? toStringByJoin(credential.data[nm]) : null;
            const v2 = db.claims[nm] ? toStringByJoin(db.claims[nm]) : null;

            if (!  (  (v1 === null && v2 === null)
                   || (typeof(v1) === typeof(v2)
                       && v1 === v2
                       )
                    )
                )
            {
                // claims do not match
                debug("new eduID does not match previous eduID claim, values:", nm, v1, v2);
                return false;
            }
        }
        debug("new eduID matches previous eduID exactly");
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
