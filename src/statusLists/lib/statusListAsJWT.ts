import { JWT } from '#root/jwt/JWT';
import moment from 'moment'
import { StatusListStatus } from '#root/types/internal/statuslists';
import { StatusListType } from '#root/statusLists/StatusListType';
import { Factory } from '@muisit/cryptokey';
import { Issuer } from '#root/issuer/Issuer';

// https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/11/
export async function statusListAsJWT(data:StatusListStatus, issuer:Issuer)
{
    const key = issuer.key!;
    const did = issuer.did!.did;

    const jwt = new JWT();

    jwt.header = {
        alg: key!.algorithms()[0],
        kid: did + '#' + Factory.getKeyReference(did),
        typ: 'statuslist+jwt',
    };

    jwt.payload = {
        iss: did,
        exp: moment(data.date).add(15, 'minutes').unix(), // considered expired
        iat: moment(data.statusList.updateDate).unix(),
        sub: data.basepath, // sub must specify the uri of the status list token
        ttl: 5 * 60, // maximum time to cache
        status_list: {
            bits: data.type.bitSize,
            // the spec defines this as a base64url encoded zlib (RC1950) compressed bit array
            // the bitstring library we use uses a gzip compression by default
            lst: await StatusListType.toZlibCompression(data.statusList)
        }
    }

    await jwt.sign(key!);
    return jwt.token;
}