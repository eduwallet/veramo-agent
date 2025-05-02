import { fromString, toString } from 'uint8arrays';
import { CryptoKey, Factory } from '@muisit/cryptokey';
import { IKey } from '@veramo/core';
import { getAgent } from '#root/agent';

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
        if (parts && parts.length == 4) {
            retval.headerPart = parts[1];
            retval.payloadPart = parts[2];
            retval.signaturePart = parts[3];

            retval.header = retval.decodeFromBase64(retval.headerPart);
            retval.payload = retval.decodeFromBase64(retval.payloadPart);
        }

        if (!retval.header || !retval.payload || !retval.signaturePart
            || Object.keys(retval.header).length == 0 || Object.keys(retval.payload).length == 0
        ) {
            throw new Error("Invalid JWT");
        }

        return retval;
    }

    async verify(key:CryptoKey)
    {
        // verify the signature against the header+payload
        const data = Buffer.from(this.headerPart + '.' + this.payloadPart);
        const alg = this.header.alg || key.algorithms()[0];
        return await key.verify(alg, fromString(this.signaturePart, 'base64url'), data);
    }

    async sign(key:CryptoKey|Function, alg?:string)
    {
        const algUsed = alg || this.header.alg || 'ES256';
        if (typeof(key) != 'function') {
            this.header.alg = algUsed;
            this.header.kid = key.exportPublicKey();
        }
        this.headerPart = this.encodeToBase64(this.header);
        this.payloadPart = this.encodeToBase64(this.payload);
        const data = Buffer.from(this.headerPart + '.' + this.payloadPart);
        if (typeof(key) != 'function') {
            this.signaturePart = await key.sign(algUsed, data, 'base64url');
        }
        else {
            this.signaturePart = await key(data);
        }
        this.token = this.headerPart + '.' + this.payloadPart + '.' + this.signaturePart;
    }

    decodeFromBase64(payload:string)
    {
        let bytes = fromString(payload, 'base64url');
        let jsonstring = toString(bytes);
        try {
            return JSON.parse(jsonstring);
        }
        catch (e) {

        }
        return null;
    }

    encodeToBase64(payload:any)
    {
        const encoded = Buffer.from(JSON.stringify(payload));
        return toString(encoded, 'base64url');
    }
}