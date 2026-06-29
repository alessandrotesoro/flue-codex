import { DEFAULT_CODEX_MODEL_TIMEOUT_MS } from './codex.constants.js';
import { composeAbortSignals, withAbortSignal } from '../support/abort.js';
import { FlueCodexError } from '../support/flue-codex-error.js';
import { isRecord } from '../support/is-record.js';
import { codexHttpFailureMessage, codexModelsUrl, timeoutSignalBundle } from './http.js';
import { resolveCodexRuntimeConfig } from './runtime-config.js';
import type { CodexDiscoveredModel, DiscoverCodexModelsOptions, RawCodexModel } from './codex.types.js';
import { normalizeCodexModel } from './model-normalization.js';

export async function discoverCodexModels(options: DiscoverCodexModelsOptions): Promise<CodexDiscoveredModel[]> {
	const { baseUrl, clientVersion } = await resolveCodexRuntimeConfig(options);
	const url = codexModelsUrl(baseUrl, clientVersion);
	const fetcher = options.fetchImpl ?? fetch;

	const timeout = timeoutSignalBundle(options.timeoutMs ?? DEFAULT_CODEX_MODEL_TIMEOUT_MS);
	const signalBundle = composeAbortSignals([options.signal, timeout.signal]);
	try {
		const response = await fetcher(url, {
			headers: {
				Authorization: `Bearer ${options.accessToken}`,
				'chatgpt-account-id': options.accountId,
				originator: 'pi',
				accept: 'application/json',
			},
			...(signalBundle.signal ? { signal: signalBundle.signal } : {}),
		});

		if (!response.ok) {
			const code =
				response.status === 401 || response.status === 403 ? 'model_access_denied' : 'model_discovery_failed';
			throw new FlueCodexError(code, codexHttpFailureMessage('Codex model discovery', response), {
				status: response.status,
			});
		}

		const json = await withAbortSignal(response.json(), signalBundle.signal).catch((error: unknown) => {
			throw new FlueCodexError('model_discovery_failed', 'Codex model discovery returned invalid JSON.', {
				cause: error,
			});
		});

		const rawModels = isRecord(json) && Array.isArray(json.models) ? (json.models as RawCodexModel[]) : [];
		const models = rawModels
			.map(normalizeCodexModel)
			.filter((model): model is CodexDiscoveredModel => model !== null);

		if (models.length === 0) {
			throw new FlueCodexError(
				'empty_model_list',
				'Codex model discovery returned no API-supported list-visible models.',
			);
		}

		return models;
	} catch (error) {
		if (error instanceof FlueCodexError) throw error;
		throw new FlueCodexError('model_discovery_failed', 'Codex model discovery request failed.', {
			cause: error,
		});
	} finally {
		signalBundle.cleanup();
		timeout.cleanup();
	}
}
