import { Key } from './entities/Key.js'
import { Identifier } from './entities/Identifier.js'
import { PrivateKey } from './entities/PrivateKey.js'
import { Credential } from './entities/Credential.js';

export const Entities = [
  Key,
  Identifier,
  PrivateKey,
  Credential,
]

export {
  Key,
  Identifier,
  PrivateKey,
  Credential,
}
export { migrations } from './migrations/index.js'
