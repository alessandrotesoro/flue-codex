import { CODEX_ACCOUNT_CLAIM } from '../constants.js';
import { isRecord } from '../is-record.js';

export interface JwtPayload {
	exp?: unknown;
	[key: string]: unknown;
}

export function decodeJwtPayload(token: string): JwtPayload | null {
	const parts = token.split('.');
	if (parts.length !== 3 || !parts[1]) return null;

	try {
		const json = Buffer.from(parts[1], 'base64url').toString('utf8');
		const parsed = JSON.parse(json);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function getJwtExpiration(token: string): Date | undefined {
	const payload = decodeJwtPayload(token);
	const exp = payload?.exp;
	return typeof exp === 'number' && Number.isFinite(exp) ? new Date(exp * 1000) : undefined;
}

export function getJwtCodexAccountId(token: string): string | undefined {
	const payload = decodeJwtPayload(token);
	const auth = payload?.[CODEX_ACCOUNT_CLAIM];
	if (isRecord(auth) && typeof auth.chatgpt_account_id === 'string' && auth.chatgpt_account_id.length > 0) {
		return auth.chatgpt_account_id;
	}
	return undefined;
}
