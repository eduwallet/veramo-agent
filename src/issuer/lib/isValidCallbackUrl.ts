export function isValidCallbackUrl(value:unknown):boolean
{
    if (typeof(value) != 'string') {
        return false;
    }
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'http:';
    }
    catch {
        return false;
    }
}
