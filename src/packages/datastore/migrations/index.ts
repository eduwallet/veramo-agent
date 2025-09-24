import { CreateDatabase1717127220001 } from './1.CreateDatabase.js';
import { Credentials1728382223150 } from './2.Credentials.js';
import { NonceAndSession1750939106000 } from './3.NonceAndSession.js';
import { Issuer1758281913150 } from './4.Issuer.js';
import { CredentialType1758699016150 } from './5.CredentialType.js';

export * from './migration-functions.js'

export const migrations = [
  CreateDatabase1717127220001,
  Credentials1728382223150,
  NonceAndSession1750939106000,
  Issuer1758281913150,
  CredentialType1758699016150
]
