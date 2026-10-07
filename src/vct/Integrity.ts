import Debug from 'debug';
const debug = Debug('issuer:vct:integrity');

import { createHash } from 'crypto';
import { Vct } from "#root/types/specification/vct";

/*
 * Computes and caches "integrity metadata" (https://www.w3.org/TR/SRI/#integrity-metadata-description)
 * values for vct#integrity claims, as defined in
 * https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-18.html#section-5
 *
 * Caching is done for the lifetime of the issuer process: a new vct version is only ever
 * rolled out together with an issuer restart, so a computed hash never goes stale in between.
 */

interface RemoteVct
{
    vct: Vct;
    integrity: string;
}

const _localIntegrityCache: Record<string, string> = {};
const _remoteVctCache: Record<string, RemoteVct> = {};

function computeIntegrity(content: string): string
{
    const hash = createHash('sha256').update(content, 'utf-8').digest('base64');
    return `sha256-${hash}`;
}

// the vct document for a locally configured vct is already available in memory, so the
// integrity hash can be computed directly from it, without an HTTP round trip
export function getLocalVctIntegrity(vct: Vct): string
{
    const key = vct.vct ?? JSON.stringify(vct);
    if (!_localIntegrityCache[key]) {
        _localIntegrityCache[key] = computeIntegrity(JSON.stringify(vct));
    }
    return _localIntegrityCache[key];
}

// a vct configured as an external URL is not necessarily available locally, so it has to be
// retrieved first before a hash can be computed over its (raw, as served) content
export async function getRemoteVctWithIntegrity(url: string): Promise<RemoteVct | null>
{
    if (_remoteVctCache[url]) {
        return _remoteVctCache[url];
    }
    try {
        const response = await fetch(url);
        const text = await response.text();
        const result: RemoteVct = {
            vct: JSON.parse(text),
            integrity: computeIntegrity(text)
        };
        _remoteVctCache[url] = result;
        return result;
    }
    catch (e) {
        debug("caught error retrieving remote vct for integrity computation", e);
        return null;
    }
}
