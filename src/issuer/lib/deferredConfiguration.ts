import { ExtendableCredentialConfiguration } from '#root/types/api/metadata';

// maximum lifetime of a deferred transaction: 48 hours
export const MAX_DEFERRED_TTL = 48 * 60 * 60;
// the default interval is a fraction of the ttl, within these bounds (in seconds)
export const DEFERRED_INTERVAL_DIVISOR = 50;
export const MIN_DEFERRED_INTERVAL = 10;
export const MAX_DEFERRED_INTERVAL = 60 * 60;

export class DeferredConfigurationError extends Error {}

export interface DeferredSettings {
    ttl: number;
    interval: number;
}

/**
 * Returns the effective deferred settings of a credential configuration, or null
 * if the configuration does not use deferred issuance.
 */
export function getDeferredSettings(config:ExtendableCredentialConfiguration|null|undefined): DeferredSettings|null
{
    if (!config?.deferred) {
        return null;
    }
    const ttl = config.deferred.ttl;
    const interval = typeof(config.deferred.interval) == 'number'
        ? config.deferred.interval
        : Math.min(MAX_DEFERRED_INTERVAL, Math.max(MIN_DEFERRED_INTERVAL, ttl / DEFERRED_INTERVAL_DIVISOR));
    return { ttl, interval };
}

/**
 * Throws a DeferredConfigurationError if a deferred credential configuration is incorrect.
 * Configurations without deferred settings are always valid.
 *
 * Every claim of a deferred credential must specify its origin explicitly, because the
 * claim may come from the offer, the back-office (#deferred) or the authorisation server.
 */
export function validateDeferredConfiguration(id:string, config:ExtendableCredentialConfiguration)
{
    if (typeof(config.deferred) == 'undefined') {
        return;
    }
    const deferred = config.deferred;
    const fail = (message:string) => { throw new DeferredConfigurationError(`Credential configuration '${id}': ${message}`); };

    if (!deferred || typeof(deferred) != 'object') {
        fail('deferred must be an object');
    }
    if (typeof(deferred.ttl) != 'number' || !Number.isFinite(deferred.ttl) || deferred.ttl <= 0) {
        fail('deferred.ttl must be a positive number of seconds');
    }
    if (deferred.ttl > MAX_DEFERRED_TTL) {
        fail(`deferred.ttl may not exceed ${MAX_DEFERRED_TTL} seconds (48 hours)`);
    }
    if (typeof(deferred.interval) != 'undefined') {
        if (typeof(deferred.interval) != 'number' || !Number.isFinite(deferred.interval) || deferred.interval <= 0) {
            fail('deferred.interval must be a positive number of seconds');
        }
        if (deferred.interval > deferred.ttl) {
            fail('deferred.interval may not exceed deferred.ttl');
        }
    }

    for (const claim of (config.credential_definition?.claims ?? [])) {
        if (!claim.origin || claim.origin.length == 0) {
            fail(`claim '${claim.path.join('.')}' has no origin, which is required for deferred credentials`);
        }
    }
    for (const key of Object.keys(config.credential_definition?.credentialSubject ?? {})) {
        const origin = config.credential_definition.credentialSubject![key].origin;
        if (!origin || origin.length == 0) {
            fail(`claim '${key}' has no origin, which is required for deferred credentials`);
        }
    }
}
