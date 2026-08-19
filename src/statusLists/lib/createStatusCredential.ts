import { StatusList } from "#root/database/entities/StatusList";
import { StatusListType } from "#root/statusLists/StatusListType";
import { StatusListCredentialAttribute } from "#root/types/internal/statuslists";

export function createStatusCredential(statusList:StatusListType, list:StatusList, index:number) : StatusListCredentialAttribute
{
    let credentialStatus:any;
    if (statusList.type == 'statuslist+jwt') {
        // IETF Token Status list
        // https://www.ietf.org/archive/id/draft-ietf-oauth-status-list-13.html#name-referenced-token-in-jose
        credentialStatus = {
            idx: index,
            uri: statusList.createCredentialUrl(list.index)
        };
    }
    else {
        // BitStringStatusList or the older versions
        credentialStatus = {
            id: statusList.pathOfIndex(list.index, index),
            type: statusList.getStatusCredentialType(),
            statusListIndex: index,
            statusListCredential: statusList.createCredentialUrl(list.index)
        };

        if (statusList.type == 'BitstringStatusList') {
            credentialStatus.statusPurpose = statusList.purpose;

            if (statusList.bitSize > 1) {
                credentialStatus.statusSize = statusList.bitSize;

                if (statusList.messages) {
                    // assume the list contains enough entries
                    credentialStatus.statusMessage = statusList.messages;
                }
                else {
                    // statusMessage MUST be present for bitsize > 1
                    credentialStatus.statusMessage = [];
                    const total = 1 << statusList.bitSize;
                    for (let i = 0; i < total; i++) {
                        credentialStatus.statusMessage.push({
                            status: "0x" + i.toString(16),
                            message: "undefined"
                        });
                    }
                }
            }
            // else for bit size 1 the messages are 0x0 => unset and 0x01 => set
        }
    }

    return credentialStatus;
}