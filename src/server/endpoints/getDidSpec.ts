import { DIDStoreValue } from '#root/dids/Store';
import { Factory } from '@muisit/cryptokey';
import { Request, Router } from 'express'
import { Issuer } from '#root/issuer/Issuer';

export function getDidSpec(issuer:Issuer) {
    issuer.router!.get('/.well-known/did.json', async (req: Request, res) => {
        const didDoc = await issuer.getDidDoc();
        return res.json(didDoc);
    });
}

export function getDidWebSpec(router:Router, value:DIDStoreValue) {
    router!.get(value.identifier.path!, async (req: Request, res) => {
         // Sphereon requires the deprecated JsonWebKey2020 verification-method instead of the default JsonWebKey
        const didDoc = await Factory.toDIDDocument(value.key, value.identifier.did, value.identifier.services ? JSON.parse(value.identifier.services) : null, 'JsonWebKey2020');
        return res.json(didDoc);
    });
}
