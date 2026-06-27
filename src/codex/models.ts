import {
  DEFAULT_CODEX_BACKEND_BASE_URL,
  DEFAULT_CODEX_MODEL_CLIENT_VERSION,
  DEFAULT_CODEX_MODEL_TIMEOUT_MS,
} from '../constants.js';
import { composeAbortSignals, withAbortSignal } from '../abort.js';
import { FlueCodexError } from '../errors.js';
import { isRecord } from '../is-record.js';
import { codexHttpFailureMessage, codexModelsUrl, timeoutSignalBundle } from './http.js';
import type { CodexDiscoveredModel, DiscoverCodexModelsOptions, RawCodexModel } from './types.js';

export async function discoverCodexModels(options: DiscoverCodexModelsOptions): Promise<CodexDiscoveredModel[]> {
  const baseUrl = options.baseUrl ?? DEFAULT_CODEX_BACKEND_BASE_URL;
  const clientVersion = options.clientVersion ?? process.env.CODEX_CLIENT_VERSION ?? DEFAULT_CODEX_MODEL_CLIENT_VERSION;
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
    const models = rawModels.map(normalizeCodexModel).filter((model): model is CodexDiscoveredModel => model !== null);

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

export function normalizeCodexModel(raw: RawCodexModel): CodexDiscoveredModel | null {
  const id = firstString(raw.slug, raw.id, raw.model);
  if (!id) return null;
  if (raw.visibility !== 'list') return null;
  if (raw.supported_in_api === false) return null;

  return {
    id,
    ...(typeof raw.display_name === 'string' ? { name: raw.display_name } : {}),
    ...(typeof raw.context_window === 'number' && Number.isFinite(raw.context_window)
      ? { contextWindow: raw.context_window }
      : {}),
    ...(typeof raw.max_output_tokens === 'number' && Number.isFinite(raw.max_output_tokens)
      ? { maxTokens: raw.max_output_tokens }
      : {}),
    isDefault: raw.is_default === true,
  };
}

export function modelOverridesForFlue(
  models: CodexDiscoveredModel[],
): Record<string, { contextWindow?: number; maxTokens?: number }> {
  return Object.fromEntries(
    models.map((model) => [
      model.id,
      {
        ...(model.contextWindow !== undefined ? { contextWindow: model.contextWindow } : {}),
        ...(model.maxTokens !== undefined ? { maxTokens: model.maxTokens } : {}),
      },
    ]),
  );
}

export function selectDefaultCodexModel(models: CodexDiscoveredModel[]): string {
  return models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? '';
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}
