import Debug from 'debug';
const debug = Debug('issuer:as');

export async function retrieveServerMetadata(endpoint:string)
{
    debug("retrieving server metadata");
    let json:any = null;
    try {
        json = await fetch(endpoint + '/.well-known/openid-configuration').then((r) => r.json());
    }
    catch (e) {
        debug("caught error", e);
        try {
            debug("trying oauth metadata");
            json = await fetch(endpoint + '/.well-known/oauth-authorization-server').then((r) => r.json());
        }
        catch (e) {
            debug("caught error, setting null", e);
            json = null;
        }
    }
    return json;
}
