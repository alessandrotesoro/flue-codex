import { describe, expect, it, vi } from 'vitest';
import { refreshCodexToken } from '../src/auth/token-refresh.js';
import { makeAccessToken, jsonResponse } from './helpers.js';

describe('token refresh', () => {
  it('posts refresh_token grant and returns normalized credentials', async () => {
    const access = makeAccessToken('acct-refresh');
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ access_token: access, refresh_token: 'new-refresh', expires_in: 3600 }),
    ) as unknown as typeof fetch;

    const result = await refreshCodexToken('old-refresh', { fetchImpl });

    expect(result).toMatchObject({
      accessToken: access,
      refreshToken: 'new-refresh',
      accountId: 'acct-refresh',
    });
    const [, init] = vi.mocked(fetchImpl).mock.calls[0]!;
    expect(String(init?.body)).toContain('grant_type=refresh_token');
    expect(String(init?.body)).toContain('client_id=');
  });

  it('fails when refresh response does not include a token account claim', async () => {
    const badAccess = [
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url'),
      Buffer.from(JSON.stringify({ exp: 9999999999 })).toString('base64url'),
      'sig',
    ].join('.');
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ access_token: badAccess, refresh_token: 'new-refresh', expires_in: 3600 }),
    ) as unknown as typeof fetch;

    await expect(refreshCodexToken('old-refresh', { fetchImpl })).rejects.toMatchObject({
      code: 'token_refresh_failed',
    });
  });
});
