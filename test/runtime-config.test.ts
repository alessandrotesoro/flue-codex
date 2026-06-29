import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
	resolveCodexBackendBaseUrl,
	resolveCodexClientVersion,
	resolveCodexRuntimeConfig,
	type ExecFileImpl,
} from '../src/codex/runtime-config.js';

describe('Codex runtime config', () => {
	it('reads the client version from the Codex models cache', async () => {
		const codexHome = await makeCodexHome({
			'models_cache.json': JSON.stringify({ client_version: '0.200.1', models: [] }),
		});

		await expect(resolveCodexClientVersion({ codexHome })).resolves.toBe('0.200.1');
	});

	it('falls back to the installed Codex executable version', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async () => ({ stdout: 'codex-cli 0.201.2\n', stderr: '' }));

		await expect(resolveCodexClientVersion({ codexHome: await makeCodexHome(), execFileImpl })).resolves.toBe(
			'0.201.2',
		);
		expect(execFileImpl).toHaveBeenCalledWith('codex', ['--version'], expect.any(Object));
	});

	it('reads the backend URL from the Codex environment override', async () => {
		await expect(
			resolveCodexBackendBaseUrl({
				env: { CODEX_API_BASE_URL: 'https://chatgpt.example.test/backend-api/' } as NodeJS.ProcessEnv,
			}),
		).resolves.toBe('https://chatgpt.example.test/backend-api');
	});

	it('infers the backend URL from Codex doctor JSON', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async () => ({
			stdout: JSON.stringify({
				checks: {
					'network.provider_reachability': {
						details: {
							'ChatGPT base URL': 'https://chatgpt.example.test/backend-api/ reachable (HTTP 403)',
						},
					},
				},
			}),
			stderr: '',
		}));

		await expect(resolveCodexBackendBaseUrl({ execFileImpl })).resolves.toBe('https://chatgpt.example.test/backend-api');
		expect(execFileImpl).toHaveBeenCalledWith(
			'codex',
			['doctor', '--json', '--summary', '--no-color', '--ascii'],
			expect.any(Object),
		);
	});

	it('uses Codex doctor JSON stdout even when the command exits nonzero', async () => {
		const error = Object.assign(new Error('doctor reported unrelated failures'), {
			stdout: JSON.stringify({
				checks: {
					'network.provider_reachability': {
						details: {
							'ChatGPT base URL': 'https://chatgpt.example.test/backend-api/ reachable (HTTP 403)',
						},
					},
				},
			}),
			stderr: '',
		});
		const execFileImpl: ExecFileImpl = vi.fn(async () => {
			throw error;
		});

		await expect(resolveCodexBackendBaseUrl({ execFileImpl })).resolves.toBe('https://chatgpt.example.test/backend-api');
	});

	it('preserves the host command environment when applying Codex env overrides', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async (_file, _args, options) => {
			expect(options.env.PATH).toBe(process.env.PATH);
			expect(options.env.FLUE_CODEX_TEST_MARKER).toBe('1');
			return {
				stdout: JSON.stringify({
					checks: {
						'network.provider_reachability': {
							details: {
								'ChatGPT base URL': 'https://chatgpt.example.test/backend-api/ reachable (HTTP 403)',
							},
						},
					},
				}),
				stderr: '',
			};
		});

		await expect(
			resolveCodexBackendBaseUrl({
				env: { FLUE_CODEX_TEST_MARKER: '1' } as NodeJS.ProcessEnv,
				execFileImpl,
			}),
		).resolves.toBe('https://chatgpt.example.test/backend-api');
	});

	it('resolves base URL and client version without static defaults', async () => {
		const codexHome = await makeCodexHome({
			'models_cache.json': JSON.stringify({ client_version: '0.202.3', models: [] }),
		});

		await expect(
			resolveCodexRuntimeConfig({
				codexHome,
				baseUrl: 'https://chatgpt.example.test/backend-api/',
			}),
		).resolves.toEqual({
			baseUrl: 'https://chatgpt.example.test/backend-api',
			clientVersion: '0.202.3',
		});
	});
});

async function makeCodexHome(files: Record<string, string> = {}): Promise<string> {
	const dir = join(tmpdir(), `flue-codex-runtime-${randomUUID()}`);
	await mkdir(dir, { recursive: true });
	await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(dir, name), `${contents}\n`)));
	return dir;
}
