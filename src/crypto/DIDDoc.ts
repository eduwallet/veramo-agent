import { CryptoKey, Factory } from "@muisit/cryptokey";

export class DIDDoc
{
    public document:any;

    public constructor(document:any)
    {
        this.document = document;
    }

    public async findKey(keyRef:string, method:string = "verificationMethod"): Promise<CryptoKey|null>
    {
        const keys = [
            ...(this.document[method] || []),
            ...(this.document['publicKey'] || [])
        ];
        for(const key of keys) {
            if (key.id == keyRef) {
                return await this.convertDIDDocumentKeyToCryptoKey(key);
            }
        }

        return null;
    }

    public async convertDIDDocumentKeyToCryptoKey(keyDoc:any): Promise<CryptoKey|null>
    {
        return Factory.createFromDIDDocument(keyDoc);
    }
}