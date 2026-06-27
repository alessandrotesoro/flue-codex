export type FlueCodexErrorCode =
	| 'missing_auth'
	| 'malformed_auth'
	| 'missing_access_token'
	| 'missing_refresh_token'
	| 'missing_account_id'
	| 'account_id_mismatch'
	| 'unsupported_auth_shape'
	| 'token_refresh_failed'
	| 'auth_write_failed'
	| 'model_discovery_failed'
	| 'model_access_denied'
	| 'empty_model_list'
	| 'provider_registration_failed';

export class FlueCodexError extends Error {
	readonly code: FlueCodexErrorCode;
	readonly status: number | undefined;

	constructor(code: FlueCodexErrorCode, message: string, options?: { cause?: unknown; status?: number }) {
		super(sanitizeSecretText(message), { cause: options?.cause });
		this.name = 'FlueCodexError';
		this.code = code;
		this.status = options?.status;
	}
}

export function isFlueCodexError(error: unknown): error is FlueCodexError {
	return error instanceof FlueCodexError;
}

export function sanitizeSecretText(value: string): string {
	return value
		.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[redacted-jwt]')
		.replace(/\bat-[A-Za-z0-9_-]+\b/g, '[redacted-token]')
		.replace(/\bsk-[A-Za-z0-9_-]+\b/g, '[redacted-key]');
}

export function errorToReportMessage(error: unknown): string {
	if (error instanceof Error) return sanitizeSecretText(error.message);
	return sanitizeSecretText(String(error));
}
