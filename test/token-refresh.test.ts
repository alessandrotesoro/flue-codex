import { describe, expect, it, vi } from 'vitest';
import { refreshCodexToken } from '../src/auth/token-refresh.js';
import { jsonResponse, makeAccessToken, makeAuth, makeJwt, mockFetch, mockJsonFetch } from './helpers.js';

const DEFAULT_DISCOVERY_URL = 'https://auth.example.test/.well-known/openid-configuration';
const DEFAULT_TOKEN_URL = 'https://auth.example.test/oauth/token';

function mockDiscoveredRefreshFetch(refreshResponse: Response): typeof fetch {
	return mockFetch(async (url) => {
		if (String(url) === DEFAULT_DISCOVERY_URL) {
			return jsonResponse({ token_endpoint: DEFAULT_TOKEN_URL });
		}

		return refreshResponse;
	});
}

describe('token refresh', () => {
	it('posts refresh_token grant and returns normalized credentials', async () => {
		const access = makeAccessToken('acct-refresh');
		const auth = makeAuth();
		const fetchImpl = mockDiscoveredRefreshFetch(
			jsonResponse({ access_token: access, refresh_token: 'new-refresh', expires_in: 3600 }),
		);

		const result = await refreshCodexToken('old-refresh', {
			accessToken: auth.tokens?.access_token as string,
			auth,
			fetchImpl,
		});

		expect(result).toMatchObject({
			accessToken: access,
			refreshToken: 'new-refresh',
			accountId: 'acct-refresh',
		});
		const refreshCall = vi.mocked(fetchImpl).mock.calls.at(1);
		if (!refreshCall) throw new Error('Expected token refresh to call fetch.');
		const [url, init] = refreshCall;
		expect(String(url)).toBe(DEFAULT_TOKEN_URL);
		expect(String(init?.body)).toContain('grant_type=refresh_token');
		expect(String(init?.body)).toContain('client_id=client-test');
	});

	it('infers the OAuth client id from the ID token audience and ignores access token audience', async () => {
		const access = makeAccessToken('acct-refresh');
		const authAccessToken = makeJwt({
			iss: 'https://auth.example.test',
			aud: 'resource-audience',
			exp: 9999999999,
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct-test',
			},
		});
		const auth = makeAuth({
			tokens: {
				access_token: authAccessToken,
				refresh_token: 'refresh-test',
				account_id: 'acct-test',
				id_token: makeJwt({ aud: 'client-from-id-token' }),
			},
		});
		const fetchImpl = mockDiscoveredRefreshFetch(
			jsonResponse({ access_token: access, refresh_token: 'new-refresh', expires_in: 3600 }),
		);

		await refreshCodexToken('old-refresh', {
			accessToken: authAccessToken,
			auth,
			fetchImpl,
		});

		const refreshCall = vi.mocked(fetchImpl).mock.calls.at(1);
		if (!refreshCall) throw new Error('Expected token refresh to call fetch.');
		const [, init] = refreshCall;
		expect(String(init?.body)).toContain('client_id=client-from-id-token');
		expect(String(init?.body)).not.toContain('client_id=resource-audience');
	});

	it('infers the OAuth client id from the first string in an ID token audience array', async () => {
		const access = makeAccessToken('acct-refresh');
		const authAccessToken = makeJwt({
			iss: 'https://auth.example.test',
			aud: 'resource-audience',
			exp: 9999999999,
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct-test',
			},
		});
		const auth = makeAuth({
			tokens: {
				access_token: authAccessToken,
				refresh_token: 'refresh-test',
				account_id: 'acct-test',
				id_token: makeJwt({ aud: ['client-from-id-token-array', 'second-client'] }),
			},
		});
		const fetchImpl = mockDiscoveredRefreshFetch(
			jsonResponse({ access_token: access, refresh_token: 'new-refresh', expires_in: 3600 }),
		);

		await refreshCodexToken('old-refresh', {
			accessToken: authAccessToken,
			auth,
			fetchImpl,
		});

		const refreshCall = vi.mocked(fetchImpl).mock.calls.at(1);
		if (!refreshCall) throw new Error('Expected token refresh to call fetch.');
		const [, init] = refreshCall;
		expect(String(init?.body)).toContain('client_id=client-from-id-token-array');
	});

	it('uses the issuer path when discovering the OAuth token endpoint', async () => {
		const access = makeAccessToken('acct-refresh');
		const authAccessToken = makeJwt({
			iss: 'https://auth.example.test/tenant',
			client_id: 'client-from-access-token',
			exp: 9999999999,
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct-test',
			},
		});
		const auth = makeAuth({
			tokens: {
				access_token: authAccessToken,
				refresh_token: 'refresh-test',
				account_id: 'acct-test',
			},
		});
		const fetchImpl = mockFetch(async (url) => {
			if (String(url) === 'https://auth.example.test/tenant/.well-known/openid-configuration') {
				return jsonResponse({ token_endpoint: 'https://auth.example.test/tenant/oauth/token' });
			}

			return jsonResponse({ access_token: access, refresh_token: 'new-refresh', expires_in: 3600 });
		});

		await refreshCodexToken('old-refresh', {
			accessToken: authAccessToken,
			auth,
			fetchImpl,
		});

		expect(String(vi.mocked(fetchImpl).mock.calls[0]?.[0])).toBe(
			'https://auth.example.test/tenant/.well-known/openid-configuration',
		);
		expect(String(vi.mocked(fetchImpl).mock.calls[1]?.[0])).toBe('https://auth.example.test/tenant/oauth/token');
	});

	it('fails before refresh when OAuth discovery fetch fails', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => {
			throw new Error('network refused');
		});

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before discovery when the OAuth issuer is not HTTPS', async () => {
		const authAccessToken = makeJwt({
			iss: 'http://auth.example.test',
			client_id: 'client-from-access-token',
			exp: 9999999999,
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct-test',
			},
		});
		const auth = makeAuth({
			tokens: {
				access_token: authAccessToken,
				refresh_token: 'refresh-test',
				account_id: 'acct-test',
			},
		});
		const fetchImpl = mockFetch(async () => {
			throw new Error('should not discover an HTTP issuer');
		});

		await expect(
			refreshCodexToken('old-refresh', { accessToken: authAccessToken, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(0);
	});

	it('fails before refresh and redacts OAuth discovery response bodies', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => {
			return new Response('client_secret=discovery-secret', { status: 500, statusText: 'Server Error' });
		});

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
			message: expect.not.stringContaining('discovery-secret'),
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before refresh when OAuth discovery returns invalid JSON', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => new Response('{', { status: 200 }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before refresh when OAuth discovery omits the token endpoint', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => jsonResponse({ issuer: 'https://auth.example.test' }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before refresh when OAuth discovery returns a non-HTTPS token endpoint', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => jsonResponse({ token_endpoint: 'http://auth.example.test/token' }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before refresh when OAuth discovery returns a private-host token endpoint', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => jsonResponse({ token_endpoint: 'https://127.0.0.1/token' }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before refresh when OAuth discovery returns a cross-origin token endpoint', async () => {
		const auth = makeAuth();
		const fetchImpl = mockFetch(async () => jsonResponse({ token_endpoint: 'https://evil.example.test/token' }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
	});

	it('fails before refresh when no OAuth client id can be inferred', async () => {
		const authAccessToken = makeJwt({
			iss: 'https://auth.example.test',
			aud: 'resource-audience',
			exp: 9999999999,
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct-test',
			},
		});
		const auth = makeAuth({
			tokens: {
				access_token: authAccessToken,
				refresh_token: 'refresh-test',
				account_id: 'acct-test',
			},
		});
		const fetchImpl = mockFetch(async () => {
			throw new Error('should not request token refresh without a client id');
		});

		await expect(
			refreshCodexToken('old-refresh', {
				accessToken: authAccessToken,
				auth,
				fetchImpl,
			}),
		).rejects.toMatchObject({
			code: 'unsupported_auth_shape',
		});
		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(0);
	});

	it('fails when refresh response does not include a token account claim', async () => {
		const badAccess = makeJwt({ exp: 9999999999 });
		const auth = makeAuth();
		const fetchImpl = mockDiscoveredRefreshFetch(
			jsonResponse({ access_token: badAccess, refresh_token: 'new-refresh', expires_in: 3600 }),
		);

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
	});

	it('does not expose non-OK response bodies in refresh errors', async () => {
		const auth = makeAuth();
		const fetchImpl = mockDiscoveredRefreshFetch(
			new Response('refresh_token=secret-refresh', { status: 400, statusText: 'Bad Request' }),
		);

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
			message: expect.not.stringContaining('secret-refresh'),
		});
	});

	it('fails when refresh response is invalid JSON', async () => {
		const auth = makeAuth();
		const fetchImpl = mockDiscoveredRefreshFetch(new Response('{', { status: 200 }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
	});

	it('fails when refresh response is missing token fields', async () => {
		const auth = makeAuth();
		const fetchImpl = mockDiscoveredRefreshFetch(jsonResponse({ access_token: makeAccessToken('acct-refresh') }));

		await expect(
			refreshCodexToken('old-refresh', { accessToken: auth.tokens?.access_token as string, auth, fetchImpl }),
		).rejects.toMatchObject({
			code: 'token_refresh_failed',
		});
	});

	it('uses an explicit token URL without OAuth discovery', async () => {
		const access = makeAccessToken('acct-refresh');
		const authAccessToken = makeJwt({
			exp: 9999999999,
			'https://api.openai.com/auth': {
				chatgpt_account_id: 'acct-test',
			},
		});
		const auth = makeAuth({
			tokens: {
				access_token: authAccessToken,
				refresh_token: 'refresh-test',
				account_id: 'acct-test',
			},
		});
		const fetchImpl = mockJsonFetch({ access_token: access, refresh_token: 'new-refresh' });

		await refreshCodexToken('old-refresh', {
			accessToken: authAccessToken,
			auth,
			tokenUrl: 'https://auth.example.test/custom-token',
			clientId: 'client-explicit',
			fetchImpl,
		});

		expect(vi.mocked(fetchImpl).mock.calls).toHaveLength(1);
		expect(String(vi.mocked(fetchImpl).mock.calls[0]?.[0])).toBe('https://auth.example.test/custom-token');
		expect(String(vi.mocked(fetchImpl).mock.calls[0]?.[1]?.body)).toContain('client_id=client-explicit');
	});
});
