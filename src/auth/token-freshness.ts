import { DEFAULT_PROACTIVE_REFRESH_MS, DEFAULT_REFRESH_SKEW_MS } from '../constants.js';
import type { CodexAuthJson } from './types.js';
import { getJwtExpiration } from './jwt.js';

export interface TokenFreshnessOptions {
	forceRefresh?: boolean | undefined;
	refreshSkewMs?: number | undefined;
	proactiveRefreshMs?: number | undefined;
	now?: Date | undefined;
}

export interface TokenFreshness {
	shouldRefresh: boolean;
	reason: 'forced' | 'missing-exp' | 'expired' | 'expiring-soon' | 'proactive' | 'fresh';
	expiresAt?: Date | undefined;
}

export function assessTokenFreshness(
	accessToken: string,
	auth: CodexAuthJson,
	options: TokenFreshnessOptions = {},
): TokenFreshness {
	const now = options.now ?? new Date();
	const refreshSkewMs = options.refreshSkewMs ?? DEFAULT_REFRESH_SKEW_MS;
	const proactiveRefreshMs = options.proactiveRefreshMs ?? DEFAULT_PROACTIVE_REFRESH_MS;

	if (options.forceRefresh) {
		return { shouldRefresh: true, reason: 'forced', expiresAt: getJwtExpiration(accessToken) };
	}

	const expiresAt = getJwtExpiration(accessToken);
	if (!expiresAt) return { shouldRefresh: true, reason: 'missing-exp' };

	const millisUntilExpiry = expiresAt.getTime() - now.getTime();
	if (millisUntilExpiry <= 0) return { shouldRefresh: true, reason: 'expired', expiresAt };
	if (millisUntilExpiry <= refreshSkewMs) {
		return { shouldRefresh: true, reason: 'expiring-soon', expiresAt };
	}

	const lastRefresh = parseLastRefresh(auth.last_refresh);
	if (lastRefresh && now.getTime() - lastRefresh.getTime() >= proactiveRefreshMs) {
		return { shouldRefresh: true, reason: 'proactive', expiresAt };
	}

	return { shouldRefresh: false, reason: 'fresh', expiresAt };
}

function parseLastRefresh(value: unknown): Date | undefined {
	if (typeof value !== 'string') return undefined;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}
