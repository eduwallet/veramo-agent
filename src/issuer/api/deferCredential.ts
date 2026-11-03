import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from "#root/issuer/Issuer";
import { CredentialOfferStatus } from "#root/types/api";
import { CredentialProofData, DeferredSessionData } from "#root/types/internal";
import { CredentialResponse } from "#root/types/specification/credential_response";
import { createUniqueId } from '#root/utils/createUniqueId';
import { DeferredSettings } from '#root/issuer/lib/deferredConfiguration';

/**
 * Register a deferred issuance transaction instead of issuing the credential.
 * The wallet gets a transaction_id to use at the deferred endpoint, and the back-office
 * has to supply or approve the claims before the credential can be collected.
 */
export async function deferCredential(issuer:Issuer, proofData:CredentialProofData, settings:DeferredSettings): Promise<CredentialResponse>
{
    const { session, credentialDataSet } = proofData;
    const existing = session.data.deferred as DeferredSessionData|undefined;
    if (existing) {
        // the wallet repeats its credential request: stay with the original transaction
        if (existing.status == CredentialOfferStatus.CREDENTIAL_PENDING || existing.status == CredentialOfferStatus.CREDENTIAL_READY) {
            debug("returning the existing deferred transaction");
            return { transaction_id: existing.transactionId, interval: existing.interval };
        }
        throw new Error('Credential transaction already completed');
    }

    const now = +new Date();
    const expiresAt = now + settings.ttl * 1000;
    const deferred:DeferredSessionData = {
        transactionId: createUniqueId(),
        status: CredentialOfferStatus.CREDENTIAL_PENDING,
        credentialId: credentialDataSet.credentialId,
        credentialDataSet,
        // the key objects are not needed anymore and cannot be stored
        holders: proofData.proofResults.map((p) => { const { ckey, ...holder } = p.holder; void ckey; return holder; }),
        claims: {},
        ttl: settings.ttl,
        interval: settings.interval,
        createdAt: now,
        expiresAt
    };
    debug("creating deferred transaction", deferred.transactionId);

    session.data.deferred = deferred;
    session.data.status = CredentialOfferStatus.CREDENTIAL_PENDING;
    session.data.lastUpdatedAt = now;
    // the session has to exist for as long as the transaction can be collected
    if (!session.expirationDate || session.expirationDate.getTime() < expiresAt) {
        session.expirationDate = new Date(expiresAt);
    }
    await issuer.storeSession(session);

    return {
        transaction_id: deferred.transactionId,
        interval: deferred.interval
    };
}
