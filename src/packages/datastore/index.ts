// base largely on the veramo/data-store plugin

export { DIDStore } from './stores/didStore.js'
export { KeyStore } from './stores/keyStore.js'
export { PrivateKeyStore } from './stores/privateKeyStore.js'
export { DataStoreORM } from './dataStoreORM.js'
import { Key } from './entities/Key.js'
import { Identifier } from './entities/Identifier.js'
import { PrivateKey } from './entities/PrivateKey.js'
import { Credential } from './entities/Credential.js';

/**
 * The TypeORM entities used by this package.
 *
 * This array SHOULD be used when creating a TypeORM connection.
 *
 * @public
 */
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
