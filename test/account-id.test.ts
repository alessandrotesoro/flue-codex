import { describe, expect, it } from 'vitest';
import { resolveCodexAccountId } from '../src/auth/account-id.js';
import { makeAccessToken, makeAuth, makeJwt } from './helpers.js';

describe('Codex account id resolution', () => {
  it('resolves the account id when stored and token claims match', () => {
    const accessToken = makeAccessToken('acct-a');
    const auth = makeAuth({ tokens: { access_token: accessToken, refresh_token: 'r', account_id: 'acct-a' } });

    expect(resolveCodexAccountId(auth, accessToken)).toEqual({
      accountId: 'acct-a',
    });
  });

  it('resolves from the token when tokens.account_id is absent', () => {
    const accessToken = makeAccessToken('acct-token');
    const auth = makeAuth({ tokens: { access_token: accessToken, refresh_token: 'r' } });

    expect(resolveCodexAccountId(auth, accessToken).accountId).toBe('acct-token');
  });

  it('fails when only the stored account id exists because the transport needs the JWT claim', () => {
    const accessToken = makeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
    const auth = makeAuth({ tokens: { access_token: accessToken, refresh_token: 'r', account_id: 'acct-stored' } });

    expect(() => resolveCodexAccountId(auth, accessToken)).toThrow(/missing the account claim/);
  });

  it('fails when stored and token account ids differ', () => {
    const accessToken = makeAccessToken('acct-token');
    const auth = makeAuth({ tokens: { access_token: accessToken, refresh_token: 'r', account_id: 'acct-stored' } });

    expect(() => resolveCodexAccountId(auth, accessToken)).toThrow(/does not match/);
  });
});
