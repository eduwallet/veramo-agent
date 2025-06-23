import { DIDStoreValue } from '#root/dids/Store';
import { Factory } from '@muisit/cryptokey';
import { Request, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js';

export function getDidSpec(issuer:Issuer) {
    issuer.router!.get('/.well-known/did.json', async (req: Request, res) => {
        const didDoc = await issuer.getDidDoc();
        return res.json(didDoc);
    });
}

export function getDidWebSpec(router:Router, value:DIDStoreValue) {
    router!.get(value.path!, async (req: Request, res) => {
        const didDoc = await Factory.toDIDDocument(value.key);
        return res.json(didDoc);
    });
}
