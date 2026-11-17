import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';

export function randomSecret(): string {
    return randomBytes(32).toString('base64url');
}

export function sha256Hex(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

export function sha256Base64Url(value: string): string {
    return createHash('sha256').update(value).digest('base64url');
}

/**
 * Constant time comparison, independent of the length of the values
 */
export function safeEqual(a: unknown, b: unknown): boolean {
    if (typeof a != 'string' || typeof b != 'string') {
        return false;
    }
    const da = createHash('sha256').update(a).digest();
    const db = createHash('sha256').update(b).digest();
    return timingSafeEqual(da, db);
}

/**
 * auth_session values and authorization codes have the form <session uuid>.<secret>, so the session can be found
 * without searching in the session data. Only the hash of the secret is stored.
 */
export function createCompositeValue(sessionUuid: string): { value: string, hash: string } {
    const secret = randomSecret();
    return { value: sessionUuid + '.' + secret, hash: sha256Hex(secret) };
}

export function parseCompositeValue(value: unknown): { uuid: string, hash: string } | null {
    if (typeof value != 'string' || value.length > 256) {
        return null;
    }
    const idx = value.indexOf('.');
    if (idx < 1 || idx == value.length - 1) {
        return null;
    }
    return { uuid: value.substring(0, idx), hash: sha256Hex(value.substring(idx + 1)) };
}

/**
 * SessionStateManager.get() returns a new, empty session when the id is unknown
 */
export async function findSession(issuer: Issuer, uuid: string): Promise<Session | null> {
    const session = await issuer.sessionData.get(uuid);
    if (!session || session.uuid !== uuid || session.id === undefined || session.id === null) {
        return null;
    }
    return session;
}

export function sessionHasExpired(session: Session): boolean {
    return !!session.expirationDate && new Date() > new Date(session.expirationDate);
}

/**
 * The remaining lifetime of an auth_session in seconds: never longer than the issuance session itself
 */
export function remainingSeconds(expiresAt: number): number {
    return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
}
