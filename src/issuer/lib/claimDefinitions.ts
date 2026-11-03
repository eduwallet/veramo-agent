import { ClaimOriginPath, ExtendableCredentialConfiguration } from '#root/types/api/metadata';

export interface ClaimDefinition {
    path: string[];          // the path of the claim in the credential data
    type: string|null;       // the configured value_type
    mandatory: boolean;
    origin: ClaimOriginPath[];
    supply: string[][];      // paths in the claims supplied by the back-office that this claim reads
}

/**
 * Normalise the claim definitions of a credential configuration, covering both the new style
 * credential_definition.claims and the old school credential_definition.credentialSubject.
 * Claims without origin read the offer data.
 */
export function getClaimDefinitions(config:ExtendableCredentialConfiguration|null|undefined): ClaimDefinition[]
{
    const definitions:ClaimDefinition[] = [];
    if (!config) {
        return definitions;
    }

    for (const claim of (config.credential_definition?.claims ?? [])) {
        const origin = claim.origin?.length ? claim.origin : [['#offer', ...claim.path]];
        definitions.push({
            path: claim.path,
            type: claim.value_type ?? null,
            mandatory: claim.mandatory ? true : false,
            origin,
            supply: getSuppliedPaths(origin),
        });
    }
    const subjects = config.credential_definition?.credentialSubject ?? {};
    for (const key of Object.keys(subjects)) {
        const value = subjects[key];
        const origin = value.origin?.length ? value.origin : [['#offer', key]];
        definitions.push({
            path: [key],
            type: value.value_type ?? null,
            mandatory: value.mandatory ? true : false,
            origin,
            supply: getSuppliedPaths(origin),
        });
    }
    return definitions;
}

// the paths in the back-office claims that can be used by the origins: #deferred and #any
function getSuppliedPaths(origins:ClaimOriginPath[]): string[][]
{
    return origins
        .filter((o) => (o[0] == '#deferred' || o[0] == '#any') && o.length > 1)
        .map((o) => o.slice(1));
}

// keys that must never be accepted as claim names
const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

/**
 * Check claims supplied by the back-office. Returns the dotted paths of all values that are
 * not read by any claim definition, and of all forbidden keys.
 */
export function findUnusedClaims(definitions:ClaimDefinition[], claims:any): { unknown:string[], forbidden:string[] }
{
    const supplied = definitions.flatMap((d) => d.supply);
    const unknown:string[] = [];
    const forbidden:string[] = [];

    const walk = (value:any, path:string[]) => {
        const isObject = value !== null && typeof(value) == 'object' && !Array.isArray(value);
        if (isObject && Object.keys(value).length > 0) {
            for (const key of Object.keys(value)) {
                if (FORBIDDEN_KEYS.includes(key)) {
                    forbidden.push([...path, key].join('.'));
                }
                else {
                    walk(value[key], [...path, key]);
                }
            }
        }
        else if (path.length > 0) {
            // a value is used if a claim reads this path, or one of its parents
            const used = supplied.some((s) => s.length <= path.length && s.every((part, i) => part === path[i]));
            if (!used) {
                unknown.push(path.join('.'));
            }
        }
    };
    walk(claims, []);
    return { unknown, forbidden };
}
