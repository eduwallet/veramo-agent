import { fromString, toString } from 'uint8arrays';
import { CryptoKey } from '@muisit/cryptokey';

export class JWT {
    public token:string;
    public headerPart:string;
    public payloadPart:string;
    public signaturePart:string;

    public header:any;
    public payload:any;


    constructor() {
        this.token = '';
        this.headerPart = '';
        this.payloadPart = '';
        this.signaturePart = '';
    }

    static fromToken(token:string)
    {
        let retval = new JWT();
        retval.token = token;
        const parts = token.match(/^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)$/)
        if (parts && parts.length == 3) {
            retval.headerPart = parts[0];
            retval.payloadPart = parts[1];
            retval.signaturePart = parts[2];

            retval.header = retval.decodeFromBase64(retval.headerPart);
            retval.payload = retval.decodeFromBase64(retval.payloadPart);
        }
        return retval;
    }

    verify(key:CryptoKey)
    {
        // verify the signature against the header+payload
        const data = this.headerPart + '.' + this.payloadPart;
        return key.verify(data);
    }

    decodeFromBase64(payload:string)
    {
        let bytes = fromString(payload, 'base64url');
        let jsonstring = toString(bytes);
        return JSON.parse(jsonstring);
    }
}