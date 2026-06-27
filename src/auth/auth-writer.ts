import { chmod, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { FlueCodexError } from '../support/flue-codex-error.js';
import { isRecord } from '../support/is-record.js';
import { resolveCodexAccountId } from './account-id.js';
import { getAccessToken } from './auth-file.js';
import type { CodexAuthJson, CodexTokenRefreshResult } from './auth.types.js';

export interface PersistRefreshedAuthOptions {
	authPath: string;
	expectedAccountId: string;
	expectedAccessToken?: string | undefined;
	expectedRefreshToken?: string | undefined;
	refreshed: CodexTokenRefreshResult;
	now?: Date | undefined;
	renameAuthFile?: typeof rename | undefined;
}

export async function persistRefreshedCodexAuth(options: PersistRefreshedAuthOptions): Promise<CodexAuthJson> {
	let current: CodexAuthJson;
	let mode: number | undefined;

	try {
		const [raw, fileStat] = await Promise.all([readFile(options.authPath, 'utf8'), stat(options.authPath)]);
		const parsed = JSON.parse(raw);
		if (!isRecord(parsed)) throw new Error('auth file root is not an object');
		current = parsed as CodexAuthJson;
		mode = fileStat.mode & 0o777;
	} catch (error) {
		throw new FlueCodexError(
			'auth_write_failed',
			`Unable to reload Codex auth before writing ${options.authPath}.`,
			{
				cause: error,
			},
		);
	}

	const currentAccountId = resolveCodexAccountId(current, getAccessToken(current)).accountId;
	if (currentAccountId !== options.expectedAccountId) {
		throw new FlueCodexError(
			'account_id_mismatch',
			'Refusing to persist refreshed Codex auth because the on-disk account id changed.',
		);
	}
	if (options.expectedAccessToken !== undefined && current.tokens?.access_token !== options.expectedAccessToken) {
		throw new FlueCodexError(
			'auth_write_failed',
			'Refusing to persist refreshed Codex auth because the on-disk access token changed.',
		);
	}
	if (options.expectedRefreshToken !== undefined && current.tokens?.refresh_token !== options.expectedRefreshToken) {
		throw new FlueCodexError(
			'auth_write_failed',
			'Refusing to persist refreshed Codex auth because the on-disk refresh token changed.',
		);
	}

	const next: CodexAuthJson = {
		...current,
		tokens: {
			...(current.tokens ?? {}),
			access_token: options.refreshed.accessToken,
			refresh_token: options.refreshed.refreshToken,
			account_id: options.refreshed.accountId,
			...(options.refreshed.idToken ? { id_token: options.refreshed.idToken } : {}),
		},
		last_refresh: (options.now ?? new Date()).toISOString(),
	};

	const tmpPath = join(dirname(options.authPath), `.auth.json.${process.pid}.${randomUUID()}.tmp`);
	const privateMode = privateAuthMode(mode);
	try {
		await writeFile(tmpPath, `${JSON.stringify(next, null, 2)}\n`, { mode: privateMode });
		await chmod(tmpPath, privateMode);
		await (options.renameAuthFile ?? rename)(tmpPath, options.authPath);
	} catch (error) {
		await unlink(tmpPath).catch(() => undefined);
		throw new FlueCodexError('auth_write_failed', `Unable to write refreshed Codex auth to ${options.authPath}.`, {
			cause: error,
		});
	}

	return next;
}

function privateAuthMode(mode: number | undefined): number {
	const ownerBits = mode === undefined ? 0o600 : mode & 0o700;
	return ownerBits === 0 ? 0o600 : ownerBits;
}
