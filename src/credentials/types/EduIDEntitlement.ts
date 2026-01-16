
import Debug from 'debug';
const debug = Debug('issuer:eduid');
import { toStringByJoin } from "#root/utils/toStringByJoin";
import { Credential } from '#root/credentials/Credential';
import { CredentialType } from "#root/credentials/types/CredentialType";
import { Session, Credential as DBCredential } from "#root/packages/datastore/index";
import { getDbConnection } from "#root/database/databaseService";
import { StatusListRevocationState } from "#root/types/api";
import moment from "moment";

export class EduIDEntitlement extends CredentialType
{
    private acceptedClaims:string[] = [
            "IsMemberOf"
    ];

    public async resolve(credential:Credential, session:Session) {
        this.setCredentialDisplay(credential);
        this.setIssuer(credential);
        credential.data = this.convertDataToClaims(credential, session);
        return true;
    }

    public check(credential:Credential)
    {
        const entitlementToLookFor = credential.data.entitlements;
        if (!Array.isArray(entitlementToLookFor) || entitlementToLookFor.length == 0) {
            return false;
        }
        return true;
    }

    private convertDataToClaims(credential:Credential, session:Session):any {
        const retval:any = {entitlement:[]};
        // this is set when the offer is created: create an entitlement for ...
        // entitlements is a list of entitlements to look for, containing at least one item
        const entitlementToLookFor = credential.data.entitlements;
        const entitlementsFound = new Set<string>();

        if (session.data.accessData.isMemberOf) {
            const memberOf = session.data.accessData.isMemberOf;
            const lst = Array.isArray(memberOf) ? memberOf : memberOf.split(' ');

            for (const entitlement of entitlementToLookFor) {
                // filter all entitlements that startWith the entitlementToLookFor
                const entitlements:string[] = lst.filter((i:string) => i.startsWith(entitlement));
                if (entitlements.length) {
                    entitlements.forEach((i:string) => entitlementsFound.add(i));
                }
            }
        }

        // no entitlement, no credential
        if (entitlementsFound.size == 0) {
            throw new Error("No entitlement found");
        }
        else {
            retval.entitlement = entitlementsFound.keys();
        }

        // enrich the credential with the 'sub' identifier claim
        credential.principalId = toStringByJoin(session.data.accessData['sub']);
        return retval;
    }
}
