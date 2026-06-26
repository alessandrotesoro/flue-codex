import { FlueCodexError } from '../errors.js';
import type { CodexAuthJson } from './types.js';
import { getJwtCodexAccountId } from './jwt.js';

export interface AccountResolution {
  accountId: string;
}

export function resolveCodexAccountId(auth: CodexAuthJson, accessToken: string): AccountResolution {
  const storedAccountId = typeof auth.tokens?.account_id === 'string' ? auth.tokens.account_id : undefined;
  const tokenAccountId = getJwtCodexAccountId(accessToken);

  if (!storedAccountId && !tokenAccountId) {
    throw new FlueCodexError(
      'missing_account_id',
      'Codex auth does not include a ChatGPT account id. Run `codex login` again.',
    );
  }

  if (!tokenAccountId) {
    throw new FlueCodexError(
      'unsupported_auth_shape',
      'Codex auth has tokens.account_id, but the access token is missing the account claim required by the current Flue Codex transport.',
    );
  }

  if (storedAccountId && storedAccountId !== tokenAccountId) {
    throw new FlueCodexError(
      'account_id_mismatch',
      'Codex auth account id does not match the account id in the access token.',
    );
  }

  return { accountId: storedAccountId ?? tokenAccountId };
}
