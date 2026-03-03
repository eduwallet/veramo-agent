export function toStringByJoin(key:string|string[]):string {
    if (Array.isArray(key)) {
        return key.sort().join(', ');
    }
    return key;
}
