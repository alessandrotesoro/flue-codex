import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
	resolveCodexBackendBaseUrl,
	resolveCodexClientVersion,
	resolveCodexRuntimeConfig,
	type CodexRuntimeConfigOptions,
	type ExecFileImpl,
} from '../src/codex/runtime-config.js';

const TEST_BACKEND_BASE_URL = 'https://chatgpt.example.test/backend-api';

describe('Codex runtime config', () => {
	it('reads the client version from the Codex models cache', async () => {
		const codexHome = await makeCodexHome({
			'models_cache.json': JSON.stringify({ client_version: '0.200.1', models: [] }),
		});

		await expect(resolveCodexClientVersion({ codexHome })).resolves.toBe('0.200.1');
	});

	it('falls back to the installed Codex executable version', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async () => ({ stdout: 'codex-cli 0.201.2\n', stderr: '' }));

		await expect(
			resolveCodexClientVersion(runtimeTestOptions({ codexHome: await makeCodexHome(), execFileImpl })),
		).resolves.toBe('0.201.2');
		expect(execFileImpl).toHaveBeenCalledWith('codex', ['--version'], expect.any(Object));
	});

	it('reads the backend URL from the Codex environment override', async () => {
		await expect(
			resolveCodexBackendBaseUrl({
				env: { CODEX_API_BASE_URL: `${TEST_BACKEND_BASE_URL}/` } as NodeJS.ProcessEnv,
			}),
		).resolves.toBe(TEST_BACKEND_BASE_URL);
	});

	it('infers the backend URL from Codex doctor JSON', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async () => ({
			stdout: doctorJsonOutput(),
			stderr: '',
		}));

		await expect(resolveCodexBackendBaseUrl(runtimeTestOptions({ execFileImpl }))).resolves.toBe(
			TEST_BACKEND_BASE_URL,
		);
		expect(execFileImpl).toHaveBeenCalledWith(
			'codex',
			['doctor', '--json', '--summary', '--no-color', '--ascii'],
			expect.any(Object),
		);
	});

	it('uses Codex doctor JSON stdout even when the command exits nonzero', async () => {
		const error = Object.assign(new Error('doctor reported unrelated failures'), {
			stdout: doctorJsonOutput(),
			stderr: '',
		});
		const execFileImpl: ExecFileImpl = vi.fn(async () => {
			throw error;
		});

		await expect(resolveCodexBackendBaseUrl(runtimeTestOptions({ execFileImpl }))).resolves.toBe(
			TEST_BACKEND_BASE_URL,
		);
	});

	it('preserves the host command environment when applying Codex env overrides', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async (_file, _args, options) => {
			expect(options.env.PATH).toBe(process.env.PATH);
			expect(options.env.FLUE_CODEX_TEST_MARKER).toBe('1');
			return {
				stdout: doctorJsonOutput(),
				stderr: '',
			};
		});

		await expect(
			resolveCodexBackendBaseUrl(
				runtimeTestOptions({
					env: { FLUE_CODEX_TEST_MARKER: '1' } as NodeJS.ProcessEnv,
					execFileImpl,
				}),
			),
		).resolves.toBe(TEST_BACKEND_BASE_URL);
	});

	it('passes an explicit Codex home to Codex subprocesses', async () => {
		const codexHome = await makeCodexHome();
		const execFileImpl: ExecFileImpl = vi.fn(async (_file, _args, options) => {
			expect(options.env.CODEX_HOME).toBe(codexHome);
			return {
				stdout: doctorJsonOutput(),
				stderr: '',
			};
		});

		await expect(resolveCodexBackendBaseUrl(runtimeTestOptions({ codexHome, execFileImpl }))).resolves.toBe(
			TEST_BACKEND_BASE_URL,
		);
	});

	it('uses a longer default timeout for Codex doctor', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async (_file, _args, options) => {
			expect(options.timeout).toBe(60_000);
			return {
				stdout: doctorJsonOutput(),
				stderr: '',
			};
		});

		await expect(resolveCodexBackendBaseUrl(runtimeTestOptions({ execFileImpl }))).resolves.toBe(
			TEST_BACKEND_BASE_URL,
		);
	});

	it('still respects the explicit runtime command timeout', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async (_file, _args, options) => {
			expect(options.timeout).toBe(1_234);
			return {
				stdout: doctorJsonOutput(),
				stderr: '',
			};
		});

		await expect(
			resolveCodexBackendBaseUrl(runtimeTestOptions({ execFileImpl, runtimeCommandTimeoutMs: 1_234 })),
		).resolves.toBe(TEST_BACKEND_BASE_URL);
	});

	it('fails clearly when the installed Codex version cannot be inferred', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async () => ({ stdout: 'codex-cli dev\n', stderr: '' }));

		await expect(
			resolveCodexClientVersion(runtimeTestOptions({ codexHome: await makeCodexHome(), execFileImpl })),
		).rejects.toMatchObject({
			code: 'runtime_metadata_unavailable',
		});
	});

	it('fails clearly when the Codex backend URL cannot be inferred', async () => {
		const execFileImpl: ExecFileImpl = vi.fn(async () => ({ stdout: '{}\n', stderr: '' }));

		await expect(resolveCodexBackendBaseUrl(runtimeTestOptions({ execFileImpl }))).rejects.toMatchObject({
			code: 'runtime_metadata_unavailable',
		});
	});

	it('resolves base URL and client version without static defaults', async () => {
		const codexHome = await makeCodexHome({
			'models_cache.json': JSON.stringify({ client_version: '0.202.3', models: [] }),
		});

		await expect(
			resolveCodexRuntimeConfig({
				codexHome,
				baseUrl: `${TEST_BACKEND_BASE_URL}/`,
			}),
		).resolves.toEqual({
			baseUrl: TEST_BACKEND_BASE_URL,
			clientVersion: '0.202.3',
		});
	});
});

type RuntimeTestOptions = CodexRuntimeConfigOptions & {
	execFileImpl?: ExecFileImpl | undefined;
};

function runtimeTestOptions(options: RuntimeTestOptions): CodexRuntimeConfigOptions {
	return options as CodexRuntimeConfigOptions;
}

function doctorJsonOutput(baseUrl = TEST_BACKEND_BASE_URL): string {
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

async function makeCodexHome(files: Record<string, string> = {}): Promise<string> {
	const dir = join(tmpdir(), `flue-codex-runtime-${randomUUID()}`);
	await mkdir(dir, { recursive: true });
	await Promise.all(Object.entries(files).map(([name, contents]) => writeFile(join(dir, name), `${contents}\n`)));
	return dir;
}
