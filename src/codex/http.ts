export { timeoutSignalBundle } from '../support/abort.js';

export function normalizeCodexBackendBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, '');
}

export function codexModelsUrl(baseUrl: string, clientVersion: string): string {
	const url = new URL(`${normalizeCodexBackendBaseUrl(baseUrl)}/codex/models`);
	url.searchParams.set('client_version', clientVersion);
	return url.toString();
}

export function codexHttpFailureMessage(operation: string, response: Response): string {
	return `${operation} failed with HTTP ${response.status}: ${response.statusText || 'request failed'}`;
}
