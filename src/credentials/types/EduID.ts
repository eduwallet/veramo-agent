
import { toStringByJoin } from "#root/utils/toStringByJoin";
import { Credential } from '#root/credentials/Credential';
import { CredentialType } from "#root/credentials/types/CredentialType";
import { Session, Credential as DBCredential } from "#root/packages/datastore/index";
import { getDbConnection } from "#root/database/databaseService";
import { StatusListRevocationState } from "#root/types/api";

export class EduID extends CredentialType
{
    private acceptedClaims:string[] = ["name", "given_name", "family_name", "email", "eduperson_assurance", "schac_home_organization", "eduperson_affiliation", "eduperson_scoped_affiliation"];

    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        await this.enrichDataWithCallback(credential, session);
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
                retval[key] = toStringByJoin(input[key]);
            }
        }
        return retval;
    }

    private async enrichDataWithCallback(credential:Credential, session:Session)
    {
        const endpoint = credential.issuer?.serverMetadata.userinfo_endpoint;
        try {
            const json = await fetch(endpoint, {
                headers: {
                    'Authorization': 'Bearer ' + session.data.accessToken
                }
            }).then((r) => r.json());
            if (json && Object.keys(json).length > 0) {
                for (const nm of this.acceptedClaims) {
                    if (json[nm]) credential.data[nm] = json[nm];
                }
                credential.principalId = toStringByJoin(json['uid']);
            }
        }
        catch (e) {
            console.error('Failed to fetch user info endpoint');
            // throw an error, do not issue a credential
            throw e;
        }
    }

    private async checkHolderkeyReuse(credential:Credential, session:Session)
    {
        // a holder key that received a EduID in the past cannot receive a new EduID again
        // UNLESS it is for the same EduID.
        const uid = credential.principalId;
        if (!uid || uid.length == 0) {
            throw new Error("Invalid uid detected, not issuing credential");
        }
        const holderKey = credential.holder;
        if (!holderKey || holderKey.length == 0) {
            throw new Error("Invalid holder key detected");
        }

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(DBCredential);
        const obj =  await repo.createQueryBuilder('credential').where('holder=:holder and credpid<>:id and "credentialId"=\'eduID\'', {holder: holderKey, id:uid}).getOne();
        if (obj) {
            throw new Error("Holder already has a different eduID assigned");
        }
        return true;
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
