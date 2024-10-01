export function toStringByJoin(key:string|string[]):string {
    if (Array.isArray(key)) {
        return key.join(', ');
    }
    return key;
}
