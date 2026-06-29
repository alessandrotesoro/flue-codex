import { isRecord } from '../support/is-record.js';

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

export function getJwtStringClaim(token: string, claim: string): string | undefined {
	const payload = decodeJwtPayload(token);
	const value = payload?.[claim];
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function getJwtCodexAccountId(token: string, expectedAccountId?: string | undefined): string | undefined {
	const payload = decodeJwtPayload(token);
	if (!payload) return undefined;

	let firstAccountId: string | undefined;
	for (const value of Object.values(payload)) {
		if (!isRecord(value)) continue;
		const accountId = value.chatgpt_account_id;
		if (typeof accountId !== 'string' || accountId.length === 0) continue;
		if (accountId === expectedAccountId) return accountId;
		firstAccountId ??= accountId;
	}

	return expectedAccountId ? undefined : firstAccountId;
}
