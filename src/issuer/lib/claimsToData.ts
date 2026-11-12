import { ClaimRequest } from '#root/types/api/credentialOffer';
import { StringKeyedObject } from '#root/types/index';

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

export function isValidClaim(claim:any):claim is ClaimRequest
{
    return claim !== null && typeof(claim) == 'object'
        && Array.isArray(claim.path) && claim.path.length > 0
        && claim.path.every((p:any) => (typeof(p) == 'string' && p.length > 0 && !FORBIDDEN_KEYS.includes(p)) || (typeof(p) == 'number' && Number.isInteger(p) && p >= 0))
        && ['string', 'boolean', 'number'].includes(typeof(claim.value));
}

/**
 * Convert a list of path/value claims into a nested data object. A numeric path element
 * addresses an array index.
 */
export function claimsToData(claims:ClaimRequest[]):StringKeyedObject
{
    const data:StringKeyedObject = {};
    for (const claim of claims) {
        let target:any = data;
        claim.path.forEach((key, idx) => {
            if (idx == claim.path.length - 1) {
                target[key] = claim.value;
            }
            else {
                if (target[key] === null || typeof(target[key]) != 'object') {
                    target[key] = typeof(claim.path[idx + 1]) == 'number' ? [] : {};
                }
                target = target[key];
            }
        });
    }
    return data;
}
