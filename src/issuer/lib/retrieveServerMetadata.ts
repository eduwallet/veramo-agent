export async function retrieveServerMetadata(endpoint:string)
{
    let json:any = null;
    try {
        json = await fetch(endpoint + '/.well-known/openid-configuration').then((r) => r.json());
    }
    catch (e) {
        try {
            json = await fetch(endpoint + '/.well-known/oauth-authorization-server').then((r) => r.json());
        }
        catch (e) {
            json = null;
        }
    }
    return json;
}
