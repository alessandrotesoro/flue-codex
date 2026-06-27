import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { vi } from 'vitest';
import type { CodexAuthJson } from '../src/auth/types.js';

export function makeJwt(payload: Record<string, unknown>): string {
	return [
		Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
		Buffer.from(JSON.stringify(payload)).toString('base64url'),
		'sig',
	].join('.');
}

export function makeAccessToken(accountId = 'acct-test', exp = Math.floor(Date.now() / 1000) + 3600): string {
	return makeJwt({
		exp,
		'https://api.openai.com/auth': {
			chatgpt_account_id: accountId,
		},
	});
}

export async function makeTempAuth(auth: CodexAuthJson): Promise<{ dir: string; authPath: string }> {
	const dir = join(tmpdir(), `flue-codex-${randomUUID()}`);
	await mkdir(dir, { recursive: true });
	const authPath = join(dir, 'auth.json');
	await writeFile(authPath, `${JSON.stringify(auth, null, 2)}\n`);
	return { dir, authPath };
}

export function makeAuth(overrides: Partial<CodexAuthJson> = {}): CodexAuthJson {
	const access = makeAccessToken();
	return {
		auth_mode: 'chatgpt',
		OPENAI_API_KEY: null,
		tokens: {
			access_token: access,
			refresh_token: 'refresh-test',
			account_id: 'acct-test',
			id_token: 'id-test',
		},
		last_refresh: new Date().toISOString(),
		...overrides,
	};
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
	return new Response(JSON.stringify(body), {
		status: 200,
		headers: { 'content-type': 'application/json' },
		...init,
	});
}

export function mockFetch(handler: typeof fetch): typeof fetch {
	return vi.fn(handler) as unknown as typeof fetch;
}

export function mockJsonFetch(body: unknown, init: ResponseInit = {}): typeof fetch {
	return mockFetch(async () => jsonResponse(body, init));
}
