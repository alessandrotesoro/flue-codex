import { FlueCodexError, errorToReportMessage } from '../support/flue-codex-error.js';
import { isRecord } from '../support/is-record.js';
import { codexHttpFailureMessage } from '../codex/http.js';
import { getJwtCodexAccountId, getJwtExpiration } from './jwt.js';
import { resolveCodexOAuthMetadata } from './oauth-metadata.js';
import type { CodexAuthJson, CodexTokenRefreshResult } from './auth.types.js';

export interface RefreshCodexTokenOptions {
	accessToken: string;
	auth: CodexAuthJson;
	fetchImpl?: typeof fetch | undefined;
	tokenUrl?: string | undefined;
	clientId?: string | undefined;
	signal?: AbortSignal | undefined;
}

export async function refreshCodexToken(
	refreshToken: string,
	options: RefreshCodexTokenOptions,
): Promise<CodexTokenRefreshResult> {
	const fetcher = options.fetchImpl ?? fetch;
	const oauth = await resolveCodexOAuthMetadata(options);

	let response: Response;
	try {
		response = await fetcher(oauth.tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				grant_type: 'refresh_token',
				refresh_token: refreshToken,
				client_id: oauth.clientId,
			}),
			...(options.signal ? { signal: options.signal } : {}),
		});
	} catch (error) {
		throw new FlueCodexError(
			'token_refresh_failed',
			`Codex token refresh request failed: ${errorToReportMessage(error)}`,
			{ cause: error },
		);
	}

	if (!response.ok) {
		throw new FlueCodexError('token_refresh_failed', codexHttpFailureMessage('Codex token refresh', response), {
			status: response.status,
		});
	}

	const json = await response.json().catch((error: unknown) => {
		throw new FlueCodexError('token_refresh_failed', 'Codex token refresh returned invalid JSON.', {
			cause: error,
		});
	});

	if (!isRecord(json) || typeof json.access_token !== 'string' || typeof json.refresh_token !== 'string') {
		throw new FlueCodexError('token_refresh_failed', 'Codex token refresh response was missing token fields.');
	}

	const accountId = getJwtCodexAccountId(json.access_token);
	if (!accountId) {
		throw new FlueCodexError(
			'token_refresh_failed',
			'Codex token refresh returned an access token without the required account claim.',
		);
	}

	const expiresAt = getJwtExpiration(json.access_token);

	return {
		accessToken: json.access_token,
		refreshToken: json.refresh_token,
		accountId,
		...(expiresAt ? { expiresAt } : {}),
		...(typeof json.id_token === 'string' ? { idToken: json.id_token } : {}),
	};
}
