import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as auth from '../src/auth/index.js';
import * as diagnostics from '../src/diagnostics/index.js';
import * as models from '../src/models/index.js';
import * as pkg from '../src/index.js';
import * as provider from '../src/provider/index.js';
import * as runtime from '../src/runtime/index.js';

const PUBLIC_SUBPATHS = ['.', './provider', './diagnostics', './auth', './runtime', './models'] as const;

describe('package exports', () => {
	it('keeps the root export focused on safe provider registration', () => {
		expect(pkg.registerCodexProvider).toEqual(expect.any(Function));
		expect(pkg.FlueCodexError).toEqual(expect.any(Function));
		expect(pkg.isFlueCodexError).toEqual(expect.any(Function));
		expect('createCodexProviderDefinition' in pkg).toBe(false);
		expect('doctorCodexProvider' in pkg).toBe(false);
		expect('discoverCodexModels' in pkg).toBe(false);
		expect('resolveCodexCredentials' in pkg).toBe(false);
	});

	it('exposes deliberate subpath APIs from source entrypoints', () => {
		expect(provider.createCodexProviderDefinition).toEqual(expect.any(Function));
		expect(diagnostics.doctorCodexProvider).toEqual(expect.any(Function));
		expect(diagnostics.runCodexLiveSmoke).toEqual(expect.any(Function));
		expect(auth.resolveCodexCredentials).toEqual(expect.any(Function));
		expect(auth.resolveCodexAuthPath).toEqual(expect.any(Function));
		expect(runtime.resolveCodexRuntimeConfig).toEqual(expect.any(Function));
		expect(models.discoverCodexModels).toEqual(expect.any(Function));
	});

	it('advertises ESM-only package exports for every public subpath', async () => {
		const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

		for (const subpath of PUBLIC_SUBPATHS) {
			expect(packageJson.exports[subpath].types).toEqual(expect.stringMatching(/^\.\/dist\/.+\.d\.ts$/));
			expect(packageJson.exports[subpath].import).toEqual(expect.stringMatching(/^\.\/dist\/.+\.js$/));
			expect(packageJson.exports[subpath].require).toBeUndefined();
		}
		expect(packageJson.main).toBe('./dist/index.js');
	});

	it('does not expose implementation helper subpaths', async () => {
		const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

		expect(packageJson.exports['./codex/model-normalization']).toBeUndefined();
		expect(packageJson.exports['./codex/model-overrides']).toBeUndefined();
		expect(packageJson.exports['./auth/jwt']).toBeUndefined();
		expect(packageJson.exports['./provider/create-provider']).toBeUndefined();
	});

	it('does not pretend to support require()', () => {
		const require = createRequire(import.meta.url);

		expect(() => require('@sematico/flue-codex')).toThrow();
	});
});
