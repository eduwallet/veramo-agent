import { DeferredConfigurationError } from '#root/issuer/lib/deferredConfiguration';
import { EmbeddedAuthorizationServerClient, IssuerConfiguration } from '#root/types/internal';

// see doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.1

export const DEFAULT_AUTH_SESSION_TTL = 86400; // seconds
export const DEFAULT_CODE_TTL = 60;            // seconds
const MAX_TTL = 7 * 86400;

export class EmbeddedASConfigurationError extends DeferredConfigurationError {}

export interface EmbeddedASSettings {
    mode: 'in-app' | 'redirect' | 'both';
    authSessionTtl: number;
    codeTtl: number;
    clients: EmbeddedAuthorizationServerClient[];
    verifierUrl?: string;
    verifierToken?: string;
}

export function getEmbeddedASSettings(options: IssuerConfiguration): EmbeddedASSettings | null {
    const cfg = options.embeddedAuthorizationServer;
    if (!cfg || !cfg.enabled) {
        return null;
    }
    return {
        mode: cfg.mode ?? 'both',
        authSessionTtl: cfg.authSessionTtl ?? DEFAULT_AUTH_SESSION_TTL,
        codeTtl: cfg.codeTtl ?? DEFAULT_CODE_TTL,
        clients: cfg.clients ?? [],
        verifierUrl: cfg.verifier?.url ? cfg.verifier.url.replace(/\/+$/, '') : undefined,
        verifierToken: cfg.verifier?.verifierToken || undefined
    };
}

/**
 * Without verifier url and verifierToken the AS cannot start a verification during issuance
 */
export function canStartPresentation(settings: EmbeddedASSettings | null): boolean {
    return !!(settings && settings.verifierUrl && settings.verifierToken);
}

function isValidRedirectUri(uri: any): boolean {
    if (typeof uri != 'string') {
        return false;
    }
    try {
        const url = new URL(uri);
        return !url.hash;
    }
    catch {
        return false;
    }
}

/**
 * Startup validation of the authorization servers of an issuer: the issuer (pre-authorized_code), the
 * embedded authorization server and an external one can be combined, but need distinct identifiers
 */
export function validateAuthorizationServerConfiguration(options: IssuerConfiguration) {
    const external = options.authorizationEndpoint;
    const hasExternal = !!(external && external.length);
    if (hasExternal && (external === options.baseUrl || external === options.baseUrl + '/as')) {
        throw new EmbeddedASConfigurationError(`Issuer ${options.name}: authorizationEndpoint cannot be the issuer itself or its embedded authorization server`);
    }
    if (options.preAuthorizedCode === false && !hasExternal && !options.embeddedAuthorizationServer?.enabled) {
        throw new EmbeddedASConfigurationError(`Issuer ${options.name}: preAuthorizedCode false requires an authorizationEndpoint or an embeddedAuthorizationServer`);
    }
}

/**
 * Startup validation of the embedded authorization server configuration. Throws an
 * EmbeddedASConfigurationError, which is fatal for the issuer store.
 */
export function validateEmbeddedASConfiguration(options: IssuerConfiguration) {
    const cfg = options.embeddedAuthorizationServer;
    if (!cfg || !cfg.enabled) {
        return;
    }
    const name = options.name;
    if (cfg.mode !== undefined && !['in-app', 'redirect', 'both'].includes(cfg.mode)) {
        throw new EmbeddedASConfigurationError(`Issuer ${name}: invalid embeddedAuthorizationServer mode`);
    }
    if (!cfg.verifier?.url || typeof cfg.verifier.url != 'string') {
        throw new EmbeddedASConfigurationError(`Issuer ${name}: embeddedAuthorizationServer requires verifier.url`);
    }
    for (const [label, value] of [['authSessionTtl', cfg.authSessionTtl], ['codeTtl', cfg.codeTtl]] as [string, number | undefined][]) {
        if (value !== undefined && (!Number.isFinite(value) || value < 1 || value > MAX_TTL)) {
            throw new EmbeddedASConfigurationError(`Issuer ${name}: embeddedAuthorizationServer ${label} out of range`);
        }
    }

    const mode = cfg.mode ?? 'both';
    const clients = cfg.clients ?? [];
    if (mode != 'in-app' && clients.length == 0) {
        throw new EmbeddedASConfigurationError(`Issuer ${name}: embeddedAuthorizationServer mode ${mode} requires clients`);
    }
    const seen = new Set<string>();
    for (const client of clients) {
        if (!client || typeof client.clientId != 'string' || !client.clientId.length) {
            throw new EmbeddedASConfigurationError(`Issuer ${name}: client without clientId`);
        }
        if (seen.has(client.clientId)) {
            throw new EmbeddedASConfigurationError(`Issuer ${name}: duplicate client ${client.clientId}`);
        }
        seen.add(client.clientId);
        if (!Array.isArray(client.redirectUris) || !client.redirectUris.length || !client.redirectUris.every(isValidRedirectUri)) {
            throw new EmbeddedASConfigurationError(`Issuer ${name}: client ${client.clientId} requires absolute redirectUris without fragment`);
        }
    }
}
