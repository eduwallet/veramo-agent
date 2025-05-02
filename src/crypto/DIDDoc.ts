import { CryptoKey, Factory } from "@muisit/cryptokey";
import { TKeyType } from "@veramo/core";

export class DIDDoc
{
    public document:any;

    public constructor(document:any)
    {
        this.document = document;
    }

    public findKey(keyRef:string, method:string = "verificationMethod"):CryptoKey|null
    {
        const keys = [
            ...(this.document[method] || []),
            ...(this.document['publicKey'] || [])
        ];
        for(const key of keys) {
            if (key.id == keyRef) {
                return this.convertDIDDocumentKeyToCryptoKey(key);
            }
        }

        return null;
    }

    public convertDIDDocumentKeyToCryptoKey(keyDoc:any):CryptoKey|null
    {
        // https://www.w3.org/TR/did-extensions-properties/#verification-method-types
        switch (keyDoc.type) {
            case 'JsonWebKey2020':
            case 'EcdsaSecp256k1VerificationKey2019':
            case 'EcdsaSecp256k1RecoveryMethod2020':
            case 'Ed25519VerificationKey2018':
                if (keyDoc.publicKeyJwk) {
                    return Factory.createFromJWK(keyDoc.publicKeyJwk);
                }
                else if(keyDoc.publicKeyHex) {
                    let keyType = 'Ed25519';
                    switch (keyDoc.type) {
                        case 'EcdsaSecp256k1VerificationKey2019':
                        case 'EcdsaSecp256k1RecoveryMethod2020': keyType = 'Secp256k1'; break;
                        case 'Ed25519VerificationKey2018': keyType = 'Ed25519'; break;
                    }
                    return Factory.createFromManagedKey({
                        kid: keyDoc.publicKeyHex,
                        type: keyType as TKeyType,
                        kms: "default",
                        publicKeyHex: keyDoc.publicKeyHex
                    });
                }
                break;
            // these are not implemented (yet)
            case 'RsaVerificationKey2018':
            case 'Bls12381G1Key2020':
            case 'Bls12381G2Key2020':
            case 'PgpVerificationKey2021':
            case 'X25519KeyAgreementKey2019':
            case 'VerifiableCondition2021': 
            
        }
        return null;        
    }
}