import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCodexProviderDefinitionWithDependencies } from '../src/provider/create-provider.js';
import { registerCodexProviderWithDependencies } from '../src/provider/register-provider.js';
import type { CreateCodexProviderDefinitionOptions } from '../src/provider/provider.types.js';
import type { ExecFileImpl } from '../src/codex/runtime-config.js';
import { makeAuth, makeTempAuth, mockJsonFetch } from './helpers.js';

const TEST_RUNTIME = {
	baseUrl: 'https://chatgpt.example.test/backend-api',
	clientVersion: 'test-version',
};

describe('Flue provider construction', () => {
	it('creates an openai-codex provider definition from local auth and live model discovery', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		const fetchImpl = mockJsonFetch({
			models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true, context_window: 2048 }],
		});

		const definition = await createCodexProviderDefinitionWithDependencies(
			{
				auth: { path: authPath },
				runtime: TEST_RUNTIME,
			},
			{ fetchImpl },
		);

		expect(definition.providerId).toBe('openai-codex');
		expect(definition.defaultModelId).toBe('openai-codex/gpt-test');
		expect(definition.defaultCodexModelId).toBe('gpt-test');
		expect(definition.modelIds).toEqual(['openai-codex/gpt-test']);
		expect(definition.codexModelIds).toEqual(['gpt-test']);
		expect(definition.registration).toMatchObject({
			api: 'openai-codex-responses',
			baseUrl: TEST_RUNTIME.baseUrl,
			models: { 'gpt-test': { contextWindow: 2048 } },
		});
		expect(definition.registration.headers).toBeUndefined();
	});

	it('registers the provider with Flue through an injectable registration function', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		const fetchImpl = mockJsonFetch({ models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true }] });
		const registerProviderImpl = vi.fn();

		const result = await registerCodexProviderWithDependencies(
			{
				auth: { path: authPath },
				runtime: TEST_RUNTIME,
			},
			{ fetchImpl, registerProviderImpl },
		);

		expect(result.providerId).toBe('openai-codex');
		expect(result.defaultModelId).toBe('openai-codex/gpt-test');
		expect(result.modelIds).toEqual(['openai-codex/gpt-test']);
		expect(result).not.toHaveProperty('registration');
		expect(registerProviderImpl).toHaveBeenCalledWith(
			'openai-codex',
			expect.objectContaining({ apiKey: expect.any(String), api: 'openai-codex-responses' }),
		);
	});

	it('infers runtime metadata when provider options omit base URL and client version', async () => {
		const { authPath, dir: codexHome } = await makeTempAuth(makeAuth());
		await writeFile(join(codexHome, 'models_cache.json'), `${JSON.stringify({ client_version: '0.203.4' })}\n`);
		const fetchImpl = mockJsonFetch({
			models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true, context_window: 4096 }],
		});
		const execFileImpl: ExecFileImpl = vi.fn(async (_file, _args, options) => {
			expect(options.env.CODEX_HOME).toBe(codexHome);
			return {
				stdout: doctorJsonOutput(),
				stderr: '',
			};
		});

		const definition = await createCodexProviderDefinitionWithDependencies(
			providerRuntimeTestOptions({
				auth: { path: authPath, codexHome },
			}),
			{ fetchImpl, execFileImpl },
		);

		expect(definition.registration).toMatchObject({
			baseUrl: TEST_RUNTIME.baseUrl,
			models: { 'gpt-test': { contextWindow: 4096 } },
		});
		expect(execFileImpl).toHaveBeenCalledWith(
			'codex',
			['doctor', '--json', '--summary', '--no-color', '--ascii'],
			expect.any(Object),
		);
		expect(String(vi.mocked(fetchImpl).mock.calls[0]?.[0])).toContain('0.203.4');
	});

	it('wraps Flue provider registration failures', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		const fetchImpl = mockJsonFetch({ models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true }] });

		await expect(
			registerCodexProviderWithDependencies(
				{
					auth: { path: authPath },
					runtime: TEST_RUNTIME,
				},
				{
					fetchImpl,
					registerProviderImpl: () => {
						throw new Error('registry refused');
					},
				},
			),
		).rejects.toMatchObject({ code: 'provider_registration_failed' });
	});
});

type ProviderRuntimeTestOptions = CreateCodexProviderDefinitionOptions;

function providerRuntimeTestOptions(options: ProviderRuntimeTestOptions): CreateCodexProviderDefinitionOptions {
	return options;
}

function doctorJsonOutput(baseUrl = TEST_RUNTIME.baseUrl): string {
	return JSON.stringify({
		checks: {
			'network.provider_reachability': {
				details: {
					'ChatGPT base URL': `${baseUrl}/ reachable (HTTP 403)`,
				},
			},
		},
	});
}
