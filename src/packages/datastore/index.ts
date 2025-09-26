import { Key } from './entities/Key.js'
import { Identifier } from './entities/Identifier.js'
import { PrivateKey } from './entities/PrivateKey.js'
import { Credential } from './entities/Credential.js';
import { Session } from './entities/Session.js';
import { Nonce } from './entities/Nonce.js';
import { Issuer } from './entities/Issuer.js';
import { CredentialType } from './entities/CredentialType.js';
import { ContextDocument } from './entities/ContextDocument.js';
import { VCTDocument } from './entities/VCTDocument.js';

export const Entities = [
  Key,
  Identifier,
  Issuer,
  PrivateKey,
  Credential,
  Session,
  Nonce,
  CredentialType,
  ContextDocument,
  VCTDocument
]

export {
  Key,
  Identifier,
  Issuer,
  PrivateKey,
  Credential,
  Session,
  Nonce,
  CredentialType,
  ContextDocument,
  VCTDocument
}
export { migrations } from './migrations/index.js'
