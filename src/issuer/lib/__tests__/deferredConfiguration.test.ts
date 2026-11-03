import { expect, test, describe } from 'vitest';
import {
    getDeferredSettings,
    validateDeferredConfiguration,
    DeferredConfigurationError,
    MAX_DEFERRED_TTL,
} from '../deferredConfiguration';
import { Issuer } from '#root/issuer/Issuer';

function config(deferred?:any, extra:any = {}): any {
    return {
        format: 'dc+sd-jwt',
        credential_definition: {
            type: ['Test'],
            claims: [{ path: ['name'], origin: [['#deferred', 'name']] }],
            ...extra,
        },
        ...(deferred !== undefined && { deferred }),
    };
}

describe('getDeferredSettings', () => {
    test('returns null without deferred configuration', () => {
        expect(getDeferredSettings(config())).toBeNull();
        expect(getDeferredSettings(null)).toBeNull();
    });

    test('defaults the interval to ttl/50 within the bounds', () => {
        expect(getDeferredSettings(config({ ttl: 3600 }))).toEqual({ ttl: 3600, interval: 72 });
        // 48 hours / 50 = 3456 seconds, no rounding
        expect(getDeferredSettings(config({ ttl: MAX_DEFERRED_TTL }))!.interval).toBeCloseTo(3456);
        // lower bound
        expect(getDeferredSettings(config({ ttl: 100 }))!.interval).toBe(10);
        // upper bound
        expect(getDeferredSettings(config({ ttl: 1e7 }))!.interval).toBe(3600);
    });

    test('uses an explicit interval as is', () => {
        expect(getDeferredSettings(config({ ttl: 3600, interval: 5 }))).toEqual({ ttl: 3600, interval: 5 });
    });
});

describe('validateDeferredConfiguration', () => {
    test('accepts configurations without deferred', () => {
        expect(() => validateDeferredConfiguration('a', config(undefined, { claims: [{ path: ['x'] }] }))).not.toThrow();
    });

    test('accepts a correct deferred configuration', () => {
        expect(() => validateDeferredConfiguration('a', config({ ttl: 3600 }))).not.toThrow();
        expect(() => validateDeferredConfiguration('a', config({ ttl: MAX_DEFERRED_TTL, interval: 60 }))).not.toThrow();
    });

    test.each([
        [{ ttl: 0 }],
        [{ ttl: -5 }],
        [{ ttl: 'x' }],
        [{}],
        [{ ttl: MAX_DEFERRED_TTL + 1 }],
        [{ ttl: 100, interval: 0 }],
        [{ ttl: 100, interval: 101 }],
        [null],
    ])('rejects incorrect deferred settings %j', (deferred) => {
        expect(() => validateDeferredConfiguration('a', config(deferred))).toThrow(DeferredConfigurationError);
    });

    test('rejects claims without origin', () => {
        expect(() => validateDeferredConfiguration('a', config({ ttl: 3600 }, { claims: [{ path: ['x'] }] }))).toThrow(DeferredConfigurationError);
        expect(() => validateDeferredConfiguration('a', config({ ttl: 3600 }, { claims: [{ path: ['x'], origin: [] }] }))).toThrow(DeferredConfigurationError);
        expect(() => validateDeferredConfiguration('a', config({ ttl: 3600 }, { claims: [], credentialSubject: { name: {} } }))).toThrow(DeferredConfigurationError);
    });

    test('accepts credentialSubject claims with origin', () => {
        expect(() => validateDeferredConfiguration('a', config({ ttl: 3600 }, { claims: [], credentialSubject: { name: { origin: [['#any', 'name']] } } }))).not.toThrow();
    });
});

describe('Issuer metadata', () => {
    function issuer(configs:any) {
        return new Issuer(
            { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
            { credential_configurations_supported: configs, credential_issuer: '', credential_endpoint: '' } as any
        );
    }

    test('publishes the deferred endpoint only when a credential is deferred', () => {
        expect(issuer({ a: config() }).generateMetadata().deferred_credential_endpoint).toBeUndefined();
        expect(issuer({ a: config(), b: config({ ttl: 3600 }) }).generateMetadata().deferred_credential_endpoint)
            .toBe('https://example.com/issuer/deferred');
    });

    test('validateConfiguration throws for a faulty deferred configuration', () => {
        expect(() => issuer({ a: config({ ttl: 0 }) }).validateConfiguration()).toThrow(DeferredConfigurationError);
        expect(() => issuer({ a: config({ ttl: 3600 }) }).validateConfiguration()).not.toThrow();
    });
});
