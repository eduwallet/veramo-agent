import { Request, Router } from 'express'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { context } from '../../agent';
import { IIssuerInstanceArgs } from '@sphereon/ssi-sdk.oid4vci-issuer';
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

const didDocForIdentifier = (identifier: IIdentifier, issuer: VcIssuer<DIDDocument>) => {
  const allKeys = identifier.keys.map((key) => ({
    id: identifier.did + '#' + key.kid,
    type: keyMapping[key.type],
    controller: identifier.did,
    publicKeyHex: key.publicKeyHex,
  }));

  const services = identifier.keys.map((key) => ({
    id: identifier.did + '#' + key.kid,
    type: "OID4VCI",
    serviceEndpoint: issuer.issuerMetadata.credential_issuer
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

export function getDidSpec(router: Router, issuer: VcIssuer<DIDDocument>, instanceArgs:IIssuerInstanceArgs) {
    router.get(didDocEndpoint, async (req: RequestWithAgentDIDManager, res) => {
      const storeId = instanceArgs.storeId ?? await context?.agent.oid4vciStoreDefaultStoreId();
      const namespace = instanceArgs.namespace ?? await context?.agent.oid4vciStoreDefaultNamespace();
      const options = await context.agent.oid4vciStoreGetIssuerOpts({
        correlationId: instanceArgs.credentialIssuer,
        storeId,
        namespace,
      });
      if (options?.didOpts?.identifierOpts?.kid && context.agent) {
        try {
          const serverIdentifier = await context?.agent.didManagerGet({did: options?.didOpts?.identifierOpts?.kid});
          const didDoc = didDocForIdentifier(serverIdentifier, issuer);
          return res.json(didDoc);
        } catch (e) {
          return res.status(404).send(e)
        }
      }
      return res.status(404).send("key not found")
    });
}
