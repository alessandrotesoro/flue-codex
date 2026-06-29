import { composeAbortSignals, timeoutSignalBundle } from '../support/abort.js';
import { DEFAULT_CODEX_REFRESH_TIMEOUT_MS } from './auth.constants.js';
import { FlueCodexError, isFlueCodexError } from '../support/flue-codex-error.js';
import { resolveCodexAccountId } from './account-id.js';
import { getAccessToken, getRefreshToken, readCodexAuthFile } from './auth-file.js';
import { persistRefreshedCodexAuth } from './auth-writer.js';
import { assessTokenFreshness } from './token-freshness.js';
import { refreshCodexToken } from './token-refresh.js';
import type {
	CodexAuthJson,
	CodexOAuthCredentials,
	CodexTokenRefreshResult,
	ResolveCodexCredentialsOptions,
} from './auth.types.js';

export async function resolveCodexCredentials(
	options: ResolveCodexCredentialsOptions = {},
): Promise<CodexOAuthCredentials> {
	const { authPath, auth } = await readCodexAuthFile(options);
	const accessToken = getAccessToken(auth);
	const account = resolveCodexAccountId(auth, accessToken);
	const freshness = assessTokenFreshness(accessToken, auth, options);

	if (!freshness.shouldRefresh) {
		return {
			accessToken,
			refreshToken: getRefreshToken(auth),
			accountId: account.accountId,
			authPath,
			refreshed: false,
			expiresAt: freshness.expiresAt,
		};
	}

	const refreshToken = getRefreshToken(auth);
	if (!refreshToken) {
		throw new FlueCodexError(
			'missing_refresh_token',
			`Codex access token needs refresh (${freshness.reason}), but tokens.refresh_token is missing. Run \`codex login\` again.`,
		);
	}

	const refreshTimeout = timeoutSignalBundle(
		options.refreshTimeoutMs ?? options.timeoutMs ?? DEFAULT_CODEX_REFRESH_TIMEOUT_MS,
	);
	const refreshSignal = composeAbortSignals([options.signal, refreshTimeout.signal]);

	let refreshed: CodexTokenRefreshResult;
	try {
		refreshed = await refreshCodexToken(refreshToken, {
			accessToken,
			auth,
			fetchImpl: options.fetchImpl,
			tokenUrl: options.tokenUrl,
			clientId: options.clientId,
			signal: refreshSignal.signal,
		});
	} catch (error) {
		if (!isFlueCodexError(error) || error.code !== 'token_refresh_failed') throw error;
		return await adoptRefreshedCodexCredentials({
			authPath,
			expectedAccountId: account.accountId,
			options,
			cause: error,
		});
	} finally {
		refreshSignal.cleanup();
		refreshTimeout.cleanup();
	}

	if (refreshed.accountId !== account.accountId) {
		throw new FlueCodexError(
			'account_id_mismatch',
			'Codex token refresh returned credentials for a different account.',
		);
	}

	let updatedAuth: CodexAuthJson;
	try {
		updatedAuth = await persistRefreshedCodexAuth({
			authPath,
			expectedAccountId: account.accountId,
			expectedAccessToken: accessToken,
			expectedRefreshToken: refreshToken,
			refreshed,
			now: options.now,
		});
	} catch (error) {
		if (!isFlueCodexError(error) || error.code !== 'auth_write_failed') throw error;
		return await adoptRefreshedCodexCredentials({
			authPath,
			expectedAccountId: account.accountId,
			options,
			cause: error,
		});
	}

	return {
		accessToken: refreshed.accessToken,
		refreshToken: refreshed.refreshToken,
		accountId: refreshed.accountId,
		authPath,
		refreshed: true,
		expiresAt: refreshed.expiresAt,
	};
}

async function adoptRefreshedCodexCredentials(input: {
	authPath: string;
	expectedAccountId: string;
	options: ResolveCodexCredentialsOptions;
	cause: unknown;
}): Promise<CodexOAuthCredentials> {
	const { auth } = await readCodexAuthFile({ authPath: input.authPath });
	const accessToken = getAccessToken(auth);
	const account = resolveCodexAccountId(auth, accessToken);
	const freshness = assessTokenFreshness(accessToken, auth, input.options);

	if (account.accountId === input.expectedAccountId && !freshness.shouldRefresh) {
		return {
			accessToken,
			refreshToken: getRefreshToken(auth),
			accountId: account.accountId,
			authPath: input.authPath,
			refreshed: true,
			expiresAt: freshness.expiresAt,
		};
	}

	throw input.cause;
}
