import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { resolveCodexCredentials } from '../src/auth/resolve-credentials.js';
import { makeAccessToken, makeAuth, makeTempAuth, mockJsonFetch } from './helpers.js';

describe('resolveCodexCredentials', () => {
  it('refreshes expired credentials, persists them, and passes an abort signal', async () => {
    const expiredAccess = makeAccessToken('acct-test', 1);
    const refreshedAccess = makeAccessToken('acct-test');
    const { authPath } = await makeTempAuth(
      makeAuth({
        tokens: {
          access_token: expiredAccess,
          refresh_token: 'old-refresh',
          account_id: 'acct-test',
        },
      }),
    );
    const fetchImpl = mockJsonFetch({ access_token: refreshedAccess, refresh_token: 'new-refresh' });

    const credentials = await resolveCodexCredentials({ authPath, fetchImpl });

    expect(credentials.refreshed).toBe(true);
    expect(credentials.accessToken).toBe(refreshedAccess);
    expect(credentials.refreshToken).toBe('new-refresh');
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(init?.signal).toBeInstanceOf(AbortSignal);

    const saved = JSON.parse(await readFile(authPath, 'utf8'));
    expect(saved.tokens.access_token).toBe(refreshedAccess);
    expect(saved.tokens.refresh_token).toBe('new-refresh');
  });

  it('fails clearly when an expired token has no refresh token', async () => {
    const { authPath } = await makeTempAuth(
      makeAuth({
        tokens: {
          access_token: makeAccessToken('acct-test', 1),
          account_id: 'acct-test',
        },
      }),
    );

    await expect(resolveCodexCredentials({ authPath })).rejects.toMatchObject({ code: 'missing_refresh_token' });
  });

  it('rejects refreshed credentials for a different account', async () => {
    const { authPath } = await makeTempAuth(
      makeAuth({
        tokens: {
          access_token: makeAccessToken('acct-test', 1),
          refresh_token: 'old-refresh',
          account_id: 'acct-test',
        },
      }),
    );
    const fetchImpl = mockJsonFetch({ access_token: makeAccessToken('acct-other'), refresh_token: 'new-refresh' });

    await expect(resolveCodexCredentials({ authPath, fetchImpl })).rejects.toMatchObject({ code: 'account_id_mismatch' });
  });
});
