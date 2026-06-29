import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createCodexProvider, registerCodexProvider, type CreateCodexProviderOptions } from '../src/index.js';
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

		const definition = await createCodexProvider({
			authPath,
			fetchImpl,
			...TEST_RUNTIME,
		});

		expect(definition.providerId).toBe('openai-codex');
		expect(definition.defaultModel).toBe('gpt-test');
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

		const result = await registerCodexProvider({
			authPath,
			fetchImpl,
			registerProviderImpl,
			...TEST_RUNTIME,
		});

		expect(result.providerId).toBe('openai-codex');
		expect(result.modelIds).toEqual(['gpt-test']);
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

		const definition = await createCodexProvider(
			providerRuntimeTestOptions({
				authPath,
				codexHome,
				fetchImpl,
				execFileImpl,
			}),
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
			registerCodexProvider({
				authPath,
				fetchImpl,
				registerProviderImpl: () => {
					throw new Error('registry refused');
				},
				...TEST_RUNTIME,
			}),
		).rejects.toMatchObject({ code: 'provider_registration_failed' });
	});
});

type ProviderRuntimeTestOptions = CreateCodexProviderOptions & {
	execFileImpl?: ExecFileImpl | undefined;
};

function providerRuntimeTestOptions(options: ProviderRuntimeTestOptions): CreateCodexProviderOptions {
	return options as CreateCodexProviderOptions;
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
