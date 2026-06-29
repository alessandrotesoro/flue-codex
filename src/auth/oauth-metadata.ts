import { FlueCodexError } from '../support/flue-codex-error.js';
import { isRecord } from '../support/is-record.js';
import { codexHttpFailureMessage } from '../codex/http.js';
import type { CodexAuthJson } from './auth.types.js';
import { decodeJwtPayload, getJwtStringClaim } from './jwt.js';

export interface CodexOAuthMetadata {
	clientId: string;
	tokenUrl: string;
}

export interface ResolveCodexOAuthMetadataOptions {
	accessToken: string;
	auth: CodexAuthJson;
	fetchImpl?: typeof fetch | undefined;
	tokenUrl?: string | undefined;
	clientId?: string | undefined;
	signal?: AbortSignal | undefined;
}

export async function resolveCodexOAuthMetadata(
	options: ResolveCodexOAuthMetadataOptions,
): Promise<CodexOAuthMetadata> {
	const clientId = stringField(options.clientId) ?? inferOAuthClientId(options.auth, options.accessToken);
	if (!clientId) {
		throw new FlueCodexError(
			'unsupported_auth_shape',
			'Codex auth does not include an OAuth client id in the current login token. Run `codex login` again.',
		);
	}

	const issuer = inferOAuthIssuer(options.auth, options.accessToken);
	const tokenUrl = stringField(options.tokenUrl);
	if (tokenUrl) {
		return {
			clientId,
			tokenUrl,
		};
	}

	if (!issuer) {
		throw new FlueCodexError(
			'unsupported_auth_shape',
			'Codex auth does not include an OAuth issuer in the current login token. Run `codex login` again.',
		);
	}

	return {
		clientId,
		tokenUrl: await discoverTokenEndpoint(issuer, options),
	};
}

export function inferOAuthClientId(auth: CodexAuthJson, accessToken: string): string | undefined {
	const tokenClientId = stringField(auth.tokens?.client_id) ?? stringField(auth.client_id);
	return tokenClientId ?? getJwtStringClaim(accessToken, 'client_id') ?? inferIdTokenAudienceClientId(auth);
}

export function inferOAuthIssuer(auth: CodexAuthJson, accessToken: string): string | undefined {
	return stringField(auth.tokens?.issuer) ?? stringField(auth.issuer) ?? getJwtStringClaim(accessToken, 'iss');
}

async function discoverTokenEndpoint(
	issuer: string,
	options: Pick<ResolveCodexOAuthMetadataOptions, 'fetchImpl' | 'signal'>,
): Promise<string> {
	const issuerUrl = parseUrl(issuer, 'Codex OAuth issuer is not a valid URL.');
	validateDiscoveredUrl(issuerUrl, 'Codex OAuth issuer');
	const discoveryUrl = oidcDiscoveryUrl(issuerUrl);
	const fetcher = options.fetchImpl ?? fetch;

	let response: Response;
	try {
		response = await fetcher(discoveryUrl, {
			headers: { accept: 'application/json' },
			...(options.signal ? { signal: options.signal } : {}),
		});
	} catch (error) {
		throw new FlueCodexError('token_refresh_failed', 'Unable to discover Codex OAuth token endpoint.', {
			cause: error,
		});
	}

	if (!response.ok) {
		throw new FlueCodexError(
			'token_refresh_failed',
			codexHttpFailureMessage('Codex OAuth discovery', response),
			{ status: response.status },
		);
	}

	const json = await response.json().catch((error: unknown) => {
		throw new FlueCodexError('token_refresh_failed', 'Codex OAuth discovery returned invalid JSON.', {
			cause: error,
		});
	});

	const tokenEndpoint = isRecord(json) ? json.token_endpoint : undefined;
	if (typeof tokenEndpoint !== 'string' || tokenEndpoint.length === 0) {
		throw new FlueCodexError('token_refresh_failed', 'Codex OAuth discovery did not include a token endpoint.');
	}

	const tokenEndpointUrl = parseUrl(tokenEndpoint, 'Codex OAuth discovery returned an invalid token endpoint.');
	validateDiscoveredUrl(tokenEndpointUrl, 'Codex OAuth token endpoint');
	if (tokenEndpointUrl.origin !== issuerUrl.origin) {
		throw new FlueCodexError(
			'token_refresh_failed',
			'Codex OAuth discovery returned a token endpoint on a different origin than the issuer.',
		);
	}

	return tokenEndpointUrl.toString();
}

function inferIdTokenAudienceClientId(auth: CodexAuthJson): string | undefined {
	const idTokenAudience = auth.tokens?.id_token;
	if (typeof idTokenAudience !== 'string') return undefined;
	const idTokenPayload = decodeJwtPayload(idTokenAudience);
	const aud = idTokenPayload?.aud;
	if (typeof aud === 'string' && aud.length > 0) return aud;
	if (Array.isArray(aud)) {
		return aud.find((value): value is string => typeof value === 'string' && value.length > 0);
	}

	return undefined;
}

function parseUrl(value: string, message: string): URL {
	try {
		return new URL(value);
	} catch (error) {
		throw new FlueCodexError('token_refresh_failed', message, { cause: error });
	}
}

function validateDiscoveredUrl(url: URL, label: string): void {
	if (url.protocol !== 'https:') {
		throw new FlueCodexError('token_refresh_failed', `${label} must use HTTPS.`);
	}

	if (isPrivateHost(url.hostname)) {
		throw new FlueCodexError('token_refresh_failed', `${label} must not point at a private host.`);
	}
}

function isPrivateHost(hostname: string): boolean {
	const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (normalized === 'localhost' || normalized === '::1') return true;
	if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')) return true;

	const ipv4 = normalized.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!ipv4) return false;

	const parts = ipv4.slice(1).map((part) => Number.parseInt(part, 10));
	if (parts.some((part) => part > 255)) return false;
	const [first = 0, second = 0] = parts;
	return (
		first === 10 ||
		first === 127 ||
		(first === 169 && second === 254) ||
		(first === 172 && second >= 16 && second <= 31) ||
		(first === 192 && second === 168)
	);
}

function oidcDiscoveryUrl(issuer: URL): string {
	const url = new URL(issuer);
	const issuerPath = url.pathname.replace(/\/+$/, '');
	url.pathname = `${issuerPath}/.well-known/openid-configuration`;
	url.search = '';
	url.hash = '';
	return url.toString();
}

function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
