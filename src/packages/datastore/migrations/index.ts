import { CreateDatabase1717127220001 } from './1.CreateDatabase.js';
import { Credentials1728382223150 } from './2.Credentials.js';
import { NonceAndSession1750939106000 } from './3.NonceAndSession.js';
import { Issuer1758281913150 } from './4.Issuer.js';
import { CredentialType1758699016150 } from './5.CredentialType.js';
import { Documents1758721139150 } from './6.Documents.js';
import { DIDPath1760691999150 } from './7.DIDPath.js';
import { CredStatus1761663603150 } from './8.CredStatus.js';
import { ClientSecret1764064638150 } from './9.ClientSecret.js';
import { EncKey1762521078111 } from './8. EncKey.js';

export * from './migration-functions.js'

export const migrations = [
  CreateDatabase1717127220001,
  Credentials1728382223150,
  NonceAndSession1750939106000,
  Issuer1758281913150,
  CredentialType1758699016150,
  Documents1758721139150,
  DIDPath1760691999150,
  CredStatus1761663603150,
  ClientSecret1764064638150,
  EncKey1762521078111
]
