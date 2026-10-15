import { test, expect, vi, beforeAll, afterAll } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

vi.mock('#root/issuer/Store', () => ({
    getIssuerStore: () => ({ acme: { options: { adminToken: 'issuer-secret' } }, other: { options: {} } }),
}));

import { adminAuthRateLimiter } from '../rateLimiters';

let server: Server;
let base: string;

beforeAll(async () => {
    process.env.BEARER_TOKEN = 'global-secret';
    const app = express();
    app.use('/api', adminAuthRateLimiter);
    app.get('/api/ping', (_req, res) => { res.json({ ok: true }); });
    await new Promise<void>((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
    delete process.env.BEARER_TOKEN;
    server.close();
});

const call = async (token?: string) =>
    (await fetch(`${base}/api/ping`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })).status;

test('requests with a valid issuer or global admin token are never rate limited', async () => {
    for (let i = 0; i < 20; i++) {
        expect(await call('issuer-secret')).toBe(200);
        expect(await call('global-secret')).toBe(200);
    }
});

test('unauthenticated and wrongly authenticated requests are limited to 5 per minute', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) statuses.push(await call());
    for (let i = 0; i < 4; i++) statuses.push(await call('wrong'));
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429, 429, 429]);
});

test('valid tokens keep working while the client address is rate limited', async () => {
    expect(await call()).toBe(429);
    expect(await call('issuer-secret')).toBe(200);
});
