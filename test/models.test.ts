import { describe, expect, it, vi } from 'vitest';
import { discoverCodexModels, modelOverridesForFlue, normalizeCodexModel } from '../src/codex/models.js';
import { mockFetch, mockJsonFetch } from './helpers.js';

describe('Codex model discovery', () => {
	it('normalizes only list-visible API-supported models', () => {
		expect(
			normalizeCodexModel({
				slug: 'gpt-test',
				display_name: 'GPT Test',
				visibility: 'list',
				supported_in_api: true,
				context_window: 1000,
			}),
		).toMatchObject({ id: 'gpt-test', name: 'GPT Test', contextWindow: 1000 });

		expect(normalizeCodexModel({ slug: 'hidden', visibility: 'hide', supported_in_api: true })).toBeNull();
		expect(normalizeCodexModel({ slug: 'no-api', visibility: 'list', supported_in_api: false })).toBeNull();
	});

	it('calls /codex/models with account headers', async () => {
		const fetchImpl = mockJsonFetch({
			models: [
				{
					slug: 'gpt-test',
					visibility: 'list',
					supported_in_api: true,
					context_window: 123,
					is_default: true,
				},
				{ slug: 'hidden', visibility: 'hide', supported_in_api: true },
			],
		});

		const models = await discoverCodexModels({
			accessToken: 'access',
			accountId: 'acct',
			baseUrl: '[redacted-codex-backend-url]/',
			clientVersion: 'test-version',
			fetchImpl,
		});

		expect(models).toHaveLength(1);
		expect(models[0]).toMatchObject({ id: 'gpt-test', contextWindow: 123, isDefault: true });
		const firstCall = vi.mocked(fetchImpl).mock.calls.at(0);
		if (!firstCall) throw new Error('Expected Codex model discovery to call fetch.');
		const [url, init] = firstCall;
		expect(String(url)).toBe('[redacted-codex-backend-url]/codex/models?client_version=test-version');
		expect((init?.headers as Record<string, string>)['chatgpt-account-id']).toBe('acct');
		expect((init?.headers as Record<string, string>).originator).toBe('pi');
	});

	it('fails on empty usable model lists', async () => {
		const fetchImpl = mockJsonFetch({ models: [{ slug: 'hidden', visibility: 'hide' }] });

		await expect(discoverCodexModels({ accessToken: 'a', accountId: 'acct', fetchImpl })).rejects.toMatchObject({
			code: 'empty_model_list',
		});
	});

	it.each([401, 403])('maps HTTP %i to model_access_denied', async (status) => {
		const fetchImpl = mockJsonFetch({ error: 'denied' }, { status });

		await expect(discoverCodexModels({ accessToken: 'a', accountId: 'acct', fetchImpl })).rejects.toMatchObject({
			code: 'model_access_denied',
			status,
		});
	});

	it('does not expose non-OK response bodies in discovery errors', async () => {
		const fetchImpl = mockFetch(
			async () => new Response('refresh_token=secret-refresh', { status: 500, statusText: 'Oops' }),
		);

		await expect(discoverCodexModels({ accessToken: 'a', accountId: 'acct', fetchImpl })).rejects.toMatchObject({
			code: 'model_discovery_failed',
			message: expect.not.stringContaining('secret-refresh'),
		});
	});

	it('keeps timeout active while reading the model response body', async () => {
		const fetchImpl = mockFetch(
			async () =>
				({
					ok: true,
					json: () => new Promise(() => undefined),
				}) as Response,
		);

		await expect(
			discoverCodexModels({ accessToken: 'a', accountId: 'acct', fetchImpl, timeoutMs: 1 }),
		).rejects.toMatchObject({
			code: 'model_discovery_failed',
		});
	});

	it('keeps the default timeout even when caller provides a signal', async () => {
		const fetchImpl = mockFetch(
			async () =>
				({
					ok: true,
					json: () => new Promise(() => undefined),
				}) as Response,
		);
		const controller = new AbortController();

		await expect(
			discoverCodexModels({
				accessToken: 'a',
				accountId: 'acct',
				fetchImpl,
				signal: controller.signal,
				timeoutMs: 1,
			}),
		).rejects.toMatchObject({
			code: 'model_discovery_failed',
		});
	});

	it('maps invalid JSON to model_discovery_failed', async () => {
		const fetchImpl = mockFetch(async () => new Response('{', { status: 200 }));

		await expect(discoverCodexModels({ accessToken: 'a', accountId: 'acct', fetchImpl })).rejects.toMatchObject({
			code: 'model_discovery_failed',
		});
	});

	it('maps fetch failures to model_discovery_failed', async () => {
		const fetchImpl = mockFetch(async () => {
			throw new Error('network down');
		});

		await expect(discoverCodexModels({ accessToken: 'a', accountId: 'acct', fetchImpl })).rejects.toMatchObject({
			code: 'model_discovery_failed',
		});
	});

	it('maps only Flue-supported model override fields', () => {
		expect(
			modelOverridesForFlue([
				{ id: 'gpt-a', contextWindow: 10, maxTokens: 5, isDefault: false },
				{ id: 'gpt-b', isDefault: false },
			]),
		).toEqual({
			'gpt-a': { contextWindow: 10, maxTokens: 5 },
			'gpt-b': {},
		});
	});
});
