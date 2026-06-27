import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import * as pkg from '../src/index.js';

describe('package exports', () => {
	it('exports public APIs', () => {
		expect(pkg.createCodexProvider).toEqual(expect.any(Function));
		expect(pkg.registerCodexProvider).toEqual(expect.any(Function));
		expect(pkg.doctorCodexProvider).toEqual(expect.any(Function));
		expect(pkg.discoverCodexModels).toEqual(expect.any(Function));
	});

	it('advertises ESM-only package exports', async () => {
		const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

		expect(packageJson.exports['.'].import).toBe('./dist/index.js');
		expect(packageJson.exports['.'].require).toBeUndefined();
		expect(packageJson.main).toBe('./dist/index.js');
	});

	it('does not pretend to support require()', () => {
		const require = createRequire(import.meta.url);

		expect(() => require('@sematico/flue-codex')).toThrow();
	});
});
