export function removeTrailingSlash(url:string)
{
    while (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    return url;
}
