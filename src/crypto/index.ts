import { TKeyType } from '@veramo/core';

export enum Alg {
    EdDSA = 'EdDSA',
    ES256 = 'ES256',
    ES256K = 'ES256K',
    PS256 = 'PS256',
    PS384 = 'PS384',
    PS512 = 'PS512',
    RS256 = 'RS256',
    RS384 = 'RS384',
    RS512 = 'RS512',
}

//export type TKeyType = 'Ed25519' | 'Secp256k1' | 'Secp256r1' | 'X25519' | 'RSA' | 'Bls12381G1' | 'Bls12381G2'

// mapping key types to key output types in the DIDDocument
export const keyMapping: Record<TKeyType, string> = {
  Secp256k1: 'EcdsaSecp256k1VerificationKey2019',
  Secp256r1: 'EcdsaSecp256r1VerificationKey2019',
  // we need JsonWebKey2020 output
  Ed25519: 'JsonWebKey2020', //'Ed25519VerificationKey2018', 
  X25519: 'X25519KeyAgreementKey2019',
  Bls12381G1: 'Bls12381G1Key2020',
  Bls12381G2: 'Bls12381G2Key2020',
//  RSA: 'RsaVerificationKey2018'
}

// TODO: OBV3 says the following:
// > The signing algorithm MUST be "RS256" as a minimum as defined in [RFC7518]. Support for
// > other algorithms is permitted but their use limits interoperability. Later versions of
// > this specification MAY add OPTIONAL support for other algorithms. See Section 6.1 RSA Key
// > of the IMS Global Security Framework v1.1.
//
// So we must support RS256 at least, and should remove the other algorithms.
export const algMapping: Record<TKeyType, Alg> = {
  Ed25519: Alg.EdDSA,
  X25519: Alg.EdDSA,
  Secp256k1: Alg.ES256,
  Secp256r1: Alg.ES256K,
//  RSA: Alg.RS512,
  Bls12381G1: Alg.ES256, // incorrect
  Bls12381G2: Alg.ES256 // incorrect
}
