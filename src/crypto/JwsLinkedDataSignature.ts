/*
 * Based on the code at https://github.com/digitalbazaar/jws-linked-data-signature
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 * Copyright (c) 2025 SURFnet/muis IT All rights reserved
 * 
 * https://w3c-ccg.github.io/lds-jws2020/
 */
import jsigs from 'jsonld-signatures';
import { CryptoKey, Factory } from '@muisit/cryptokey';
import { JWT } from '#root/jwt/JWT';
import { toString } from 'uint8arrays';
const {LinkedDataSignature} = jsigs.suites;

export interface JwsLDPOptions {
  type?: string;
  alg?: string;
  LDKeyClass?: string;
  key:CryptoKey;
  proof?:any; // JSON-LD document with options to used for the proof node
  date?:string|Date; // signing date to use
  contextUrl?: string; // context url for this signature
  useNativeCanonize?: boolean; 
}

export class JwsLinkedDataSignature extends LinkedDataSignature {
  private alg:string;
  private ckey:CryptoKey;

  constructor({alg, key, proof, date, useNativeCanonize}:JwsLDPOptions) {
    const tempKey = {
      signer: {
        id: 'none',
        sign: async (data:Uint8Array) => await key.sign(alg!, data),
      },
      verifier: {
        id: 'none',
        verify: async (signature:Uint8Array, data:Uint8Array) => await key.verify(alg!, signature, data)
      }
    };
    super({
      type: 'JsonWebSignature2020',
      contextUrl: "https://w3id.org/security/suites/jws-2020/v1",
      tempKey, // temporary key to prevent parameter validation errors
      proof,
      date,
      useNativeCanonize,
      canonizeOptions: {
        safe:false,
        eventHandler: JwsLinkedDataSignature.eventHandler
      }
    });
    this.alg = (alg ?? key?.algorithms()[0]) ?? 'EdDSA';
    this.ckey = key;
  }

  /**
   * @param {object} options - Options hashmap.
   * @param {Uint8Array} options.verifyData - The data to sign.
   * @param {object} options.proof - A JSON-LD document with options to use
   *   for the `proof` node. Any other custom fields can be provided here
   *   using a context different from `security-v2`.
   *
   * @returns {Promise<{object}>} The proof containing the signature value.
   */
  async sign({verifyData, proof}:{verifyData:Uint8Array, proof:any}) {
    const jwt = new JWT();
    jwt.header = {
      alg: this.alg,
      b64: true, // true means payload is base64url encoded, false means it is not
      crit: ['b64']
    };
    jwt.payloadPart = toString(verifyData, 'base64url');
    await jwt.sign(this.ckey);
    proof.jws = jwt.headerPart + '..' + jwt.signaturePart;
    return proof;
  }

  /**
   * @param {object} options - Options hashmap.
   * @param {Uint8Array} options.verifyData - The data to verify.
   * @param {object} options.verificationMethod - A verification method.
   * @param {object} options.proof - The proof to be verified.
   *
   * @returns {Promise<{boolean}>} Resolves with the verification result.
   */
  async verifySignature({verifyData, verificationMethod, proof}: { verifyData: Uint8Array; verificationMethod: any; proof: any; }) {
    if (!proof.jws || typeof proof.jws !== 'string') {
      throw new TypeError('The proof does not include a valid "jws" property.');
    }

    const jwt = new JWT();
    const parts = proof.jws.split('.');
    if (parts.length !== 3) {
      throw new TypeError('The proof does not include a valid "jws" property.');       
    }

    jwt.headerPart = parts[0];
    jwt.payloadPart = '';
    jwt.signaturePart = parts[1];      
    jwt.decode();

    if (jwt.header.b64 === true) {
      jwt.payloadPart = toString(verifyData, 'base64url');
    }
    else {
      jwt.payloadPart = verifyData;
    }

    // confirm header matches all expectations
    if(!(jwt.header.alg === this.alg)) {
      throw new Error('Invalid JWS header parameters');
    }

    const did = verificationMethod.id ? verificationMethod.id : verificationMethod;
    const ckey = await Factory.resolve(did);
    return jwt.verify(ckey);
  }

  async getVerificationMethod({proof, documentLoader}: {proof:any, documentLoader:any}) {
    if(this.ckey) {
      // This happens most often during sign() operations. For verify(),
      // the expectation is that the verification method will be fetched
      // by the documentLoader (below), not provided as a `key` parameter.
      const jwk = await Factory.toJWK(this.ckey);
      const did = await Factory.toDIDJWK(this.ckey);
      return {
        id: did,
        type: "JsonWebKey2020",
        controller: did,
        publicKeyJwk: jwk
      }
    }

    let {verificationMethod} = proof;

    if(typeof verificationMethod === 'object') {
      verificationMethod = verificationMethod.id;
    }

    if(!verificationMethod) {
      throw new Error('No "verificationMethod" found in proof.');
    }

    const {document} = await documentLoader(verificationMethod);

    verificationMethod = typeof document === 'string' ? JSON.parse(document) : document;
    return verificationMethod;
  }

  /**
   * Checks whether a given proof exists in the document.
   *
   * @param {object} options - Options hashmap.
   * @param {object} options.proof - A proof.
   * @param {object} options.document - A JSON-LD document.
   * @param {object} options.purpose - A jsonld-signatures ProofPurpose
   *  instance (e.g. AssertionProofPurpose, AuthenticationProofPurpose, etc).
   * @param {Function} options.documentLoader  - A secure document loader (it is
   *   recommended to use one that provides static known documents, instead of
   *   fetching from the web) for returning contexts, controller documents,
   *   keys, and other relevant URLs needed for the proof.
   *
   * @returns {Promise<boolean>} Whether a match for the proof was found.
   */
  async matchProof({proof, document, purpose, documentLoader}: { proof: any; document: object; purpose: object; documentLoader: any; }): Promise<boolean> {
    if(!await super.matchProof(
      {proof, document, purpose, documentLoader})) {
      return false;
    }
    // NOTE: When subclassing this suite: Extending suites will need to check
    // for the presence their contexts here and in sign()

    if(!this.ckey) {
      // no key specified, so assume this suite matches and it can be retrieved
      return true;
    }

    const {verificationMethod} = proof;
    const did = verificationMethod.id ? verificationMethod.id : verificationMethod;
    const key = await Factory.resolve(did);
    return key.exportPublicKey() == this.ckey.exportPublicKey();
  }

  public static eventHandler({event}:{event:any})
  {
    console.error(event);
    throw new Error("JWS Safe event handler");
  }
}
