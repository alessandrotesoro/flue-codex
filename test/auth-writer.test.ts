import { chmod, readFile, readdir, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { persistRefreshedCodexAuth } from '../src/auth/auth-writer.js';
import { makeAccessToken, makeAuth, makeTempAuth } from './helpers.js';

describe('auth writer', () => {
  it('persists refreshed token fields while preserving unrelated auth fields', async () => {
    const { authPath } = await makeTempAuth({ ...makeAuth(), future_field: 'keep' });
    const accessToken = makeAccessToken('acct-test');

    await persistRefreshedCodexAuth({
      authPath,
      expectedAccountId: 'acct-test',
      refreshed: {
        accessToken,
        refreshToken: 'new-refresh',
        accountId: 'acct-test',
      },
      now: new Date('2026-01-01T00:00:00Z'),
    });

    const saved = JSON.parse(await readFile(authPath, 'utf8'));
    expect(saved.future_field).toBe('keep');
    expect(saved.tokens.access_token).toBe(accessToken);
    expect(saved.tokens.refresh_token).toBe('new-refresh');
    expect(saved.tokens.account_id).toBe('acct-test');
    expect(saved.last_refresh).toBe('2026-01-01T00:00:00.000Z');
  });

  it('aborts when the on-disk account id changed', async () => {
    const { authPath } = await makeTempAuth(makeAuth());

    await expect(
      persistRefreshedCodexAuth({
        authPath,
        expectedAccountId: 'different-account',
        refreshed: {
          accessToken: makeAccessToken('different-account'),
          refreshToken: 'new-refresh',
          accountId: 'different-account',
        },
      }),
    ).rejects.toMatchObject({ code: 'account_id_mismatch' });
  });

  it('aborts when the same-account on-disk token changed before write', async () => {
    const originalAccess = makeAccessToken('acct-test');
    const { authPath } = await makeTempAuth(
      makeAuth({
        tokens: {
          access_token: originalAccess,
          refresh_token: 'old-refresh',
          account_id: 'acct-test',
        },
      }),
    );

    await expect(
      persistRefreshedCodexAuth({
        authPath,
        expectedAccountId: 'acct-test',
        expectedAccessToken: 'different-access',
        expectedRefreshToken: 'old-refresh',
        refreshed: {
          accessToken: makeAccessToken('acct-test'),
          refreshToken: 'new-refresh',
          accountId: 'acct-test',
        },
      }),
    ).rejects.toMatchObject({ code: 'auth_write_failed' });

    const saved = JSON.parse(await readFile(authPath, 'utf8'));
    expect(saved.tokens.access_token).toBe(originalAccess);
  });

  it('clamps refreshed auth file permissions to owner-only bits', async () => {
    const { authPath } = await makeTempAuth(makeAuth());
    await chmod(authPath, 0o644);

    await persistRefreshedCodexAuth({
      authPath,
      expectedAccountId: 'acct-test',
      refreshed: {
        accessToken: makeAccessToken('acct-test'),
        refreshToken: 'new-refresh',
        accountId: 'acct-test',
      },
    });

    expect((await stat(authPath)).mode & 0o077).toBe(0);
  });

  it('removes token-bearing temp files when atomic rename fails', async () => {
    const { dir, authPath } = await makeTempAuth(makeAuth());

    await expect(
      persistRefreshedCodexAuth({
        authPath,
        expectedAccountId: 'acct-test',
        refreshed: {
          accessToken: makeAccessToken('acct-test'),
          refreshToken: 'new-refresh',
          accountId: 'acct-test',
        },
        renameAuthFile: async () => {
          throw new Error('rename failed');
        },
      }),
    ).rejects.toMatchObject({ code: 'auth_write_failed' });

    expect((await readdir(dir)).filter((file) => file.includes('.auth.json.') && file.endsWith('.tmp'))).toEqual([]);
  });
});
