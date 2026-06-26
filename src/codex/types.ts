export interface RawCodexModel {
  slug?: unknown;
  id?: unknown;
  model?: unknown;
  display_name?: unknown;
  visibility?: unknown;
  supported_in_api?: unknown;
  context_window?: unknown;
  max_output_tokens?: unknown;
  is_default?: unknown;
  [key: string]: unknown;
}

export interface CodexDiscoveredModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  isDefault: boolean;
}

export interface DiscoverCodexModelsOptions {
  accessToken: string;
  accountId: string;
  baseUrl?: string | undefined;
  clientVersion?: string | undefined;
  timeoutMs?: number | undefined;
  fetchImpl?: typeof fetch | undefined;
  signal?: AbortSignal | undefined;
}
