export interface CodexTokenData {
	id_token?: unknown;
	access_token?: unknown;
	refresh_token?: unknown;
	account_id?: unknown;
	[key: string]: unknown;
}

export interface CodexAuthJson {
	auth_mode?: unknown;
	OPENAI_API_KEY?: unknown;
	tokens?: CodexTokenData;
	last_refresh?: unknown;
	[key: string]: unknown;
}

export interface CodexOAuthCredentials {
	accessToken: string;
	refreshToken?: string | undefined;
	accountId: string;
	authPath: string;
	refreshed: boolean;
	expiresAt?: Date | undefined;
}

export interface CodexAuthPathOptions {
	authPath?: string | undefined;
	codexHome?: string | undefined;
	env?: NodeJS.ProcessEnv | undefined;
}

export interface ResolveCodexCredentialsOptions extends CodexAuthPathOptions {
	forceRefresh?: boolean | undefined;
	refreshSkewMs?: number | undefined;
	proactiveRefreshMs?: number | undefined;
	timeoutMs?: number | undefined;
	now?: Date | undefined;
	fetchImpl?: typeof fetch | undefined;
	tokenUrl?: string | undefined;
	signal?: AbortSignal | undefined;
	refreshTimeoutMs?: number | undefined;
}

export interface CodexTokenRefreshResult {
	accessToken: string;
	refreshToken: string;
	accountId: string;
	expiresAt?: Date | undefined;
	idToken?: string | undefined;
}
