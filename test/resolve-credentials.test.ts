import { readFile, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { resolveCodexCredentials } from '../src/auth/resolve-credentials.js';
import { makeAccessToken, makeAuth, makeTempAuth, mockFetch, mockJsonFetch } from './helpers.js';

describe('resolveCodexCredentials', () => {
	it('refreshes expired credentials, persists them, and passes an abort signal', async () => {
		const expiredAccess = makeAccessToken('acct-test', 1);
		const refreshedAccess = makeAccessToken('acct-test');
		const { authPath } = await makeTempAuth(
			makeAuth({
				tokens: {
					access_token: expiredAccess,
					refresh_token: 'old-refresh',
					account_id: 'acct-test',
				},
			}),
		);
		const fetchImpl = mockJsonFetch({ access_token: refreshedAccess, refresh_token: 'new-refresh' });

		const credentials = await resolveCodexCredentials({
			authPath,
			fetchImpl,
			tokenUrl: 'https://auth.example.test/oauth/token',
		});

		expect(credentials.refreshed).toBe(true);
		expect(credentials.accessToken).toBe(refreshedAccess);
		expect(credentials.refreshToken).toBe('new-refresh');
		const firstCall = vi.mocked(fetchImpl).mock.calls.at(0);
		if (!firstCall) throw new Error('Expected credential resolution to call fetch.');
		const [, init] = firstCall;
		expect(init?.signal).toBeInstanceOf(AbortSignal);

		const saved = JSON.parse(await readFile(authPath, 'utf8'));
		expect(saved.tokens.access_token).toBe(refreshedAccess);
		expect(saved.tokens.refresh_token).toBe('new-refresh');
	});

	it('fails clearly when an expired token has no refresh token', async () => {
		const { authPath } = await makeTempAuth(
			makeAuth({
				tokens: {
					access_token: makeAccessToken('acct-test', 1),
					account_id: 'acct-test',
				},
			}),
		);

		await expect(resolveCodexCredentials({ authPath })).rejects.toMatchObject({ code: 'missing_refresh_token' });
	});

	it('rejects refreshed credentials for a different account', async () => {
		const { authPath } = await makeTempAuth(
			makeAuth({
				tokens: {
					access_token: makeAccessToken('acct-test', 1),
					refresh_token: 'old-refresh',
					account_id: 'acct-test',
				},
			}),
		);
		const fetchImpl = mockJsonFetch({ access_token: makeAccessToken('acct-other'), refresh_token: 'new-refresh' });

		await expect(
			resolveCodexCredentials({ authPath, fetchImpl, tokenUrl: 'https://auth.example.test/oauth/token' }),
		).rejects.toMatchObject({
			code: 'account_id_mismatch',
		});
	});

	it('adopts same-account auth refreshed by a concurrent caller after refresh failure', async () => {
		const expiredAccess = makeAccessToken('acct-test', 1);
		const concurrentAccess = makeAccessToken('acct-test');
		const { authPath } = await makeTempAuth(
			makeAuth({
				tokens: {
					access_token: expiredAccess,
					refresh_token: 'old-refresh',
					account_id: 'acct-test',
				},
			}),
		);
		const fetchImpl = mockFetch(async () => {
			await writeFile(
				authPath,
				`${JSON.stringify(
					makeAuth({
						tokens: {
							access_token: concurrentAccess,
							refresh_token: 'concurrent-refresh',
							account_id: 'acct-test',
						},
					}),
					null,
					2,
				)}\n`,
			);
			return new Response('invalid_grant', { status: 400, statusText: 'Bad Request' });
		});

		const credentials = await resolveCodexCredentials({
			authPath,
			fetchImpl,
			tokenUrl: 'https://auth.example.test/oauth/token',
		});

		expect(credentials).toMatchObject({
			accessToken: concurrentAccess,
			refreshToken: 'concurrent-refresh',
			accountId: 'acct-test',
			refreshed: true,
		});
	});

	it('adopts same-account auth refreshed by a concurrent caller after stale write detection', async () => {
		const expiredAccess = makeAccessToken('acct-test', 1);
		const refreshAccess = makeAccessToken('acct-test');
		const concurrentAccess = makeAccessToken('acct-test');
		const { authPath } = await makeTempAuth(
			makeAuth({
				tokens: {
					access_token: expiredAccess,
					refresh_token: 'old-refresh',
					account_id: 'acct-test',
				},
			}),
		);
		const fetchImpl = mockFetch(async () => {
			await writeFile(
				authPath,
				`${JSON.stringify(
					makeAuth({
						tokens: {
							access_token: concurrentAccess,
							refresh_token: 'concurrent-refresh',
							account_id: 'acct-test',
						},
					}),
					null,
					2,
				)}\n`,
			);
			return new Response(JSON.stringify({ access_token: refreshAccess, refresh_token: 'new-refresh' }), {
				status: 200,
				headers: { 'content-type': 'application/json' },
			});
		});

		const credentials = await resolveCodexCredentials({
			authPath,
			fetchImpl,
			tokenUrl: 'https://auth.example.test/oauth/token',
		});

		expect(credentials).toMatchObject({
			accessToken: concurrentAccess,
			refreshToken: 'concurrent-refresh',
			accountId: 'acct-test',
			refreshed: true,
		});
	});
});
