import type { HttpProviderRegistration } from '@flue/runtime';
import { OPENAI_CODEX_PROVIDER_ID, OPENAI_CODEX_RESPONSES_API } from './provider.constants.js';
import { resolveCodexCredentialsWithDependencies } from '../auth/resolve-credentials.js';
import type { CodexOAuthCredentials, ResolveCodexCredentialsOptions } from '../auth/auth.types.js';
import { discoverCodexModelsWithDependencies } from '../codex/model-discovery.js';
import { modelOverridesForFlue } from '../codex/model-overrides.js';
import { selectDefaultCodexModel } from '../codex/model-normalization.js';
import { resolveCodexRuntimeConfigWithDependencies, type CodexRuntimeConfigOptions } from '../codex/runtime-config.js';
import type { CodexDiscoveredModel } from '../codex/codex.types.js';
import type {
	CodexProviderDefinition,
	CodexProviderDependencies,
	CreateCodexProviderDefinitionOptions,
	FlueCodexModelId,
} from './provider.types.js';

export async function createCodexProviderDefinition(
	options: CreateCodexProviderDefinitionOptions = {},
): Promise<CodexProviderDefinition> {
	return createCodexProviderDefinitionWithDependencies(options);
}

export async function createCodexProviderDefinitionWithDependencies(
	options: CreateCodexProviderDefinitionOptions = {},
	dependencies: CodexProviderDependencies = {},
): Promise<CodexProviderDefinition> {
	const { credentials, models, baseUrl } = await resolveCodexProviderInputs(options, dependencies);
	return buildCodexProviderDefinition({ credentials, models, baseUrl });
}

export async function resolveCodexProviderInputs(
	options: CreateCodexProviderDefinitionOptions = {},
	dependencies: CodexProviderDependencies = {},
): Promise<{
	credentials: CodexOAuthCredentials;
	models: CodexDiscoveredModel[];
	baseUrl: string;
}> {
	const credentials = await resolveCodexCredentialsWithDependencies(toCredentialOptions(options), {
		fetchImpl: dependencies.fetchImpl,
	});

	const { baseUrl, clientVersion } = await resolveCodexRuntimeConfigWithDependencies(toRuntimeOptions(options), {
		execFileImpl: dependencies.execFileImpl,
		readFileImpl: dependencies.readFileImpl,
	});
	const models = await discoverCodexModelsWithDependencies(
		{
			accessToken: credentials.accessToken,
			accountId: credentials.accountId,
			baseUrl,
			clientVersion,
			timeoutMs: options.timeouts?.fetchMs,
			signal: options.models?.signal,
			env: options.runtime?.env ?? options.auth?.env,
		},
		{ fetchImpl: dependencies.fetchImpl },
	);

	return { credentials, models, baseUrl };
}

export function buildCodexProviderDefinition(input: {
	credentials: CodexOAuthCredentials;
	models: CodexDiscoveredModel[];
	baseUrl: string;
}): CodexProviderDefinition {
	const defaultCodexModelId = selectDefaultCodexModel(input.models);
	const codexModelIds = input.models.map((model) => model.id);
	const modelIds = codexModelIds.map(toFlueCodexModelId);
	const registration: HttpProviderRegistration = {
		api: OPENAI_CODEX_RESPONSES_API as NonNullable<HttpProviderRegistration['api']>,
		baseUrl: input.baseUrl,
		apiKey: input.credentials.accessToken,
		models: modelOverridesForFlue(input.models),
	};

	return {
		providerId: OPENAI_CODEX_PROVIDER_ID,
		registration,
		models: input.models,
		codexModelIds,
		defaultCodexModelId,
		modelIds,
		defaultModelId: toFlueCodexModelId(defaultCodexModelId),
		authPath: input.credentials.authPath,
		refreshed: input.credentials.refreshed,
	};
}

function toCredentialOptions(options: CreateCodexProviderDefinitionOptions): ResolveCodexCredentialsOptions {
	return {
		authPath: options.auth?.path,
		codexHome: options.auth?.codexHome,
		env: options.auth?.env,
		forceRefresh: options.refresh?.force,
		refreshSkewMs: options.refresh?.skewMs,
		proactiveRefreshMs: options.refresh?.proactiveMs,
		timeoutMs: options.timeouts?.fetchMs,
		now: options.refresh?.now,
		tokenUrl: options.refresh?.tokenUrl,
		clientId: options.refresh?.clientId,
		signal: options.refresh?.signal,
		refreshTimeoutMs: options.timeouts?.refreshMs,
	};
}

function toRuntimeOptions(options: CreateCodexProviderDefinitionOptions): CodexRuntimeConfigOptions {
	return {
		baseUrl: options.runtime?.baseUrl,
		clientVersion: options.runtime?.clientVersion,
		codexHome: options.runtime?.codexHome ?? options.auth?.codexHome,
		env: options.runtime?.env ?? options.auth?.env,
		runtimeCommandTimeoutMs: options.timeouts?.runtimeCommandMs,
	};
}

function toFlueCodexModelId(modelId: string): FlueCodexModelId {
	return `${OPENAI_CODEX_PROVIDER_ID}/${modelId}`;
}
