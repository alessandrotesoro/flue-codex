import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { constants as fsConstants } from 'node:fs';
import { FlueCodexError } from '../errors.js';
import type { CodexAuthJson, CodexAuthPathOptions } from './types.js';

export function resolveCodexAuthPath(options: CodexAuthPathOptions = {}): string {
  if (options.authPath) return options.authPath;
  const env = options.env ?? process.env;
  const codexHome = options.codexHome ?? env.CODEX_HOME ?? join(homedir(), '.codex');
  return join(codexHome, 'auth.json');
}

export async function readCodexAuthFile(options: CodexAuthPathOptions = {}): Promise<{
  authPath: string;
  auth: CodexAuthJson;
}> {
  const authPath = resolveCodexAuthPath(options);

  try {
    await access(authPath, fsConstants.R_OK);
  } catch (error) {
    throw new FlueCodexError(
      'missing_auth',
      `Missing Codex auth file at ${authPath}. Run \`codex login\` first.`,
      { cause: error },
    );
  }

  let raw: string;
  try {
    raw = await readFile(authPath, 'utf8');
  } catch (error) {
    throw new FlueCodexError('missing_auth', `Unable to read Codex auth file at ${authPath}.`, {
      cause: error,
    });
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isRecord(parsed)) throw new Error('auth file root is not an object');
    return { authPath, auth: parsed as CodexAuthJson };
  } catch (error) {
    throw new FlueCodexError('malformed_auth', `Codex auth file at ${authPath} is not valid JSON.`, {
      cause: error,
    });
  }
}

export function getAccessToken(auth: CodexAuthJson): string {
  const token = auth.tokens?.access_token;
  if (typeof token !== 'string' || token.length === 0) {
    throw new FlueCodexError(
      'missing_access_token',
      'Codex auth does not contain tokens.access_token. Run `codex login` again.',
    );
  }
  return token;
}

export function getRefreshToken(auth: CodexAuthJson): string | undefined {
  const token = auth.tokens?.refresh_token;
  return typeof token === 'string' && token.length > 0 ? token : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
