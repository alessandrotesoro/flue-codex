export const OPENAI_CODEX_PROVIDER_ID = 'openai-codex';
export const OPENAI_CODEX_RESPONSES_API = 'openai-codex-responses';
export const DEFAULT_CODEX_BACKEND_BASE_URL = '[redacted-codex-backend-url]';
export const DEFAULT_CODEX_MODEL_CLIENT_VERSION = '[redacted-codex-client-version]';
export const DEFAULT_CODEX_MODEL_TIMEOUT_MS = 10_000;
export const DEFAULT_CODEX_REFRESH_TIMEOUT_MS = 10_000;
export const DEFAULT_CODEX_LIVE_SMOKE_TIMEOUT_MS = 20_000;
export const DEFAULT_REFRESH_SKEW_MS = 5 * 60 * 1000;
export const DEFAULT_PROACTIVE_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

export const CODEX_AUTH_BASE_URL = 'https://auth.openai.com';
export const CODEX_TOKEN_URL = `${CODEX_AUTH_BASE_URL}/oauth/token`;
export const CODEX_OAUTH_CLIENT_ID = '[redacted-codex-oauth-client-id]';
export const CODEX_ACCOUNT_CLAIM = 'https://api.openai.com/auth';
