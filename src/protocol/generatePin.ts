export function generatePin(type:'text'|'numeric', length:number)
{
    let validTokens = '0123456789';
    if (type == 'text') {
        validTokens = 'ABCDEFGHJKMNOPRSTWXYZ'; // leave out I/L, U/V and the Q
    }
    let retval = '';
    while (retval.length < length) {
        const randomIndex = Math.floor((Math.random() * (validTokens.length - 1)) + 0.5);
        retval += validTokens[randomIndex];
    }
    return retval;
}