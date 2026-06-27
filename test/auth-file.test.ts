import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { getAccessToken, readCodexAuthFile, resolveCodexAuthPath } from '../src/auth/auth-file.js';
import type { FlueCodexError } from '../src/support/flue-codex-error.js';
import { makeAuth, makeTempAuth } from './helpers.js';

describe('Codex auth file', () => {
	it('reads valid auth from an explicit auth path', async () => {
		const { authPath } = await makeTempAuth(makeAuth());

		const result = await readCodexAuthFile({ authPath });

		expect(result.authPath).toBe(authPath);
		expect(result.auth.tokens?.account_id).toBe('acct-test');
	});

	it('honors CODEX_HOME when no explicit path is provided', async () => {
		const { dir, authPath } = await makeTempAuth(makeAuth());

		expect(resolveCodexAuthPath({ env: { CODEX_HOME: dir } as NodeJS.ProcessEnv })).toBe(authPath);
	});

	it('throws a typed error when auth is missing', async () => {
		await expect(readCodexAuthFile({ authPath: '/tmp/not-real/flue-codex-auth.json' })).rejects.toMatchObject({
			code: 'missing_auth',
		} satisfies Partial<FlueCodexError>);
	});

	it('throws a typed error when auth JSON is malformed', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		await writeFile(authPath, '{');

		await expect(readCodexAuthFile({ authPath })).rejects.toMatchObject({ code: 'malformed_auth' });
	});

	it('throws a typed error when the access token is missing', () => {
		expect(() => getAccessToken({ tokens: { refresh_token: 'refresh-test' } })).toThrow(
			expect.objectContaining({ code: 'missing_access_token' }),
		);
	});
});
