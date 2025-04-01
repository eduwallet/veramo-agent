interface ASKey {
    kid: string;
    [x:string] : any;
}

export async function retrieveASServerKey(baseurl:string): Promise<ASKey[]|null>
{
    try {
        // find the .well-knowns
        let metadata = await fetch(baseurl + '/.well-known/openid-configuration').then((r) => r.json()).catch(() => null);
        if (!metadata) {
            metadata = await fetch(baseurl + '/.well-known/oauth-authorization-server').then((r) => r.json()).catch(() => null);
        }

        if (metadata && metadata.jwks_uri) {
            let uri = metadata.jwks_uri as string;
            if (!uri.toLowerCase().startsWith('http')) {
                uri = baseurl + (uri[0] === '/' ? '' : '/') + uri;
            }
            const keydata = await fetch(uri).then((r) => r.json()).catch(() => null);
            if (keydata && keydata.keys) {
                return keydata.keys;
            }
        }
    }
    catch (e) {}
    return null;
}