import { createUniqueId } from '#root/utils/createUniqueId'
import { Credential } from '#root/credentials/Credential'
import { CredentialType } from '#root/credentials/types/CredentialType'

export class EuropeanDigitalCredential extends CredentialType {
  public async resolve(credential: Credential) {
    this.setCredentialDisplay(credential)
    this.setIssuer(credential)
    const context = credential.issuer?.getCredentialContext(credential.type)
    if (context) {
      for (const ctx of context) {
        credential.contexts.push(ctx)
      }
    }
    credential.principalId = createUniqueId()
    return true
  }

  public check(credential: Credential) {
    return true
  }
}
