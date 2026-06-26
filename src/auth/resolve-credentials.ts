import { composeAbortSignals, timeoutSignal } from '../abort.js';
import { DEFAULT_CODEX_REFRESH_TIMEOUT_MS } from '../constants.js';
import { FlueCodexError } from '../errors.js';
import { resolveCodexAccountId } from './account-id.js';
import { getAccessToken, getRefreshToken, readCodexAuthFile } from './auth-file.js';
import { persistRefreshedCodexAuth } from './auth-writer.js';
import { assessTokenFreshness } from './token-freshness.js';
import { refreshCodexToken } from './token-refresh.js';
import type { CodexOAuthCredentials, ResolveCodexCredentialsOptions } from './types.js';

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

  const refreshSignal = composeAbortSignals([
    options.signal,
    timeoutSignal(options.refreshTimeoutMs ?? options.timeoutMs ?? DEFAULT_CODEX_REFRESH_TIMEOUT_MS),
  ]);

  let refreshed;
  try {
    refreshed = await refreshCodexToken(refreshToken, {
      fetchImpl: options.fetchImpl,
      tokenUrl: options.tokenUrl,
      signal: refreshSignal.signal,
    });
  } finally {
    refreshSignal.cleanup();
  }

  if (refreshed.accountId !== account.accountId) {
    throw new FlueCodexError(
      'account_id_mismatch',
      'Codex token refresh returned credentials for a different account.',
    );
  }

  const updatedAuth = await persistRefreshedCodexAuth({
    authPath,
    expectedAccountId: account.accountId,
    expectedAccessToken: accessToken,
    expectedRefreshToken: refreshToken,
    refreshed,
    now: options.now,
  });

  return {
    accessToken: refreshed.accessToken,
    refreshToken: refreshed.refreshToken,
    accountId: refreshed.accountId,
    authPath,
    refreshed: true,
    expiresAt: refreshed.expiresAt,
  };
}
