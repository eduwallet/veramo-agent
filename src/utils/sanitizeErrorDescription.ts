// RFC 6749 section 5.2: error_description is human-readable ASCII text, using the characters
// %x20-21 / %x23-5B / %x5D-7E, so no double quotes, backslashes or non-ASCII characters.
export function sanitizeErrorDescription(text:string|undefined|null, maxLength = 200): string
{
    if (!text) {
        return '';
    }
    return String(text)
        .replace(/[^\x20-\x21\x23-\x5B\x5D-\x7E]/g, '?')
        .trim()
        .substring(0, maxLength);
}
