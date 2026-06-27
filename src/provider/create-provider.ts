import type { HttpProviderRegistration } from '@flue/runtime';
import { DEFAULT_CODEX_BACKEND_BASE_URL } from '../codex/codex.constants.js';
import { OPENAI_CODEX_PROVIDER_ID, OPENAI_CODEX_RESPONSES_API } from './provider.constants.js';
import { resolveCodexCredentials } from '../auth/resolve-credentials.js';
import type { CodexOAuthCredentials } from '../auth/auth.types.js';
import { discoverCodexModels } from '../codex/model-discovery.js';
import { modelOverridesForFlue } from '../codex/model-overrides.js';
import { selectDefaultCodexModel } from '../codex/model-normalization.js';
import type { CodexDiscoveredModel } from '../codex/codex.types.js';
import type { CodexProviderDefinition, CreateCodexProviderOptions } from './provider.types.js';

export async function createCodexProvider(options: CreateCodexProviderOptions = {}): Promise<CodexProviderDefinition> {
	const { credentials, models, baseUrl } = await resolveCodexProviderInputs(options);
	return buildCodexProviderDefinition({ credentials, models, baseUrl });
}

export async function resolveCodexProviderInputs(options: CreateCodexProviderOptions = {}): Promise<{
	credentials: CodexOAuthCredentials;
	models: CodexDiscoveredModel[];
	baseUrl: string;
}> {
	const credentials = await resolveCodexCredentials(options);

	const baseUrl = options.baseUrl ?? DEFAULT_CODEX_BACKEND_BASE_URL;
	const models = await discoverCodexModels({
		accessToken: credentials.accessToken,
		accountId: credentials.accountId,
		baseUrl,
		clientVersion: options.clientVersion,
		timeoutMs: options.timeoutMs,
		fetchImpl: options.fetchImpl,
		env: options.env,
	});

	return { credentials, models, baseUrl };
}

export function buildCodexProviderDefinition(input: {
	credentials: CodexOAuthCredentials;
	models: CodexDiscoveredModel[];
	baseUrl?: string | undefined;
}): CodexProviderDefinition {
	const baseUrl = input.baseUrl ?? DEFAULT_CODEX_BACKEND_BASE_URL;
	const registration: HttpProviderRegistration = {
		api: OPENAI_CODEX_RESPONSES_API as NonNullable<HttpProviderRegistration['api']>,
		baseUrl,
		apiKey: input.credentials.accessToken,
		models: modelOverridesForFlue(input.models),
	};

	return {
		providerId: OPENAI_CODEX_PROVIDER_ID,
		registration,
		models: input.models,
		modelIds: input.models.map((model) => model.id),
		defaultModel: selectDefaultCodexModel(input.models),
		authPath: input.credentials.authPath,
		refreshed: input.credentials.refreshed,
	};
}
