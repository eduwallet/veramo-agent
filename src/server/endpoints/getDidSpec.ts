import { Request, Router } from 'express'
import { Issuer } from 'issuer/Issuer';
import { context } from '../../agent';
import { toJwk, JwkKeyUse } from '@sphereon/ssi-sdk-ext.key-utils';
import { IIdentifier, IDIDManager, TAgent, TKeyType, DIDDocument } from '@veramo/core'
import { didDocEndpoint } from '@veramo/remote-server';

interface RequestWithAgentDIDManager extends Request {
  agent?: TAgent<IDIDManager>
}

const keyMapping: Record<TKeyType, string> = {
  Secp256k1: 'EcdsaSecp256k1VerificationKey2019',
  Secp256r1: 'EcdsaSecp256r1VerificationKey2019',
  Ed25519: 'Ed25519VerificationKey2018',
  X25519: 'X25519KeyAgreementKey2019',
  Bls12381G1: 'Bls12381G1Key2020',
  Bls12381G2: 'Bls12381G2Key2020',
  RSA: 'RsaVerificationKey2018'
}

const didDocForIdentifier = (identifier: IIdentifier, credential_issuer:string) => {
  const allKeys = identifier.keys.map((key) => ({
    id: identifier.did + '#' + key.kid,
    type: keyMapping[key.type],
    controller: identifier.did,
    publicKeyJwk: toJwk(key.publicKeyHex, key.type, { use: JwkKeyUse.Signature, key: key}),
  }));

  const services = identifier.keys.map((key) => ({
    id: identifier.did + '#' + key.kid,
    type: "OID4VCI",
    serviceEndpoint: credential_issuer
  }));

  // ed25519 keys can also be converted to x25519 for key agreement
  const keyAgreementKeyIds = allKeys
    .filter((key) => ['Ed25519VerificationKey2018', 'X25519KeyAgreementKey2019'].includes(key.type))
    .map((key) => key.id)
  const signingKeyIds = allKeys
    .filter((key) => key.type !== 'X25519KeyAgreementKey2019')
    .map((key) => key.id)

  const didDoc = {
    '@context': 'https://w3id.org/did/v1',
    id: identifier.did,
    verificationMethod: allKeys,
    authentication: signingKeyIds,
    assertionMethod: signingKeyIds,
    keyAgreement: keyAgreementKeyIds,
    service: [...services, ...(identifier?.services || [])],
  }

  return didDoc
}

export function getDidSpec(issuer:Issuer) {
    issuer.router!.get(didDocEndpoint, async (req: RequestWithAgentDIDManager, res) => {
      const options = issuer.options.options?.issuerOpts;
      if (options?.didOpts?.identifierOpts?.identifier && context.agent) {
        try {
          var serverIdentifier:IIdentifier;
          if (typeof options?.didOpts?.identifierOpts?.identifier == 'string') {
            serverIdentifier = await context?.agent.didManagerGet({did: options?.didOpts?.identifierOpts?.identifier});
          }
          else {
            serverIdentifier = options?.didOpts?.identifierOpts?.identifier;
          }
          const didDoc = didDocForIdentifier(serverIdentifier, issuer.metadata.credential_issuer);
          return res.json(didDoc);
        } catch (e) {
          return res.status(404).send(e)
        }
      }
      return res.status(404).send("key not found")
    });
}
