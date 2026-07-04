import type { HttpProviderRegistration } from '@flue/runtime';
import type { CodexDiscoveredModel } from '../codex/codex.types.js';
import type { ExecFileImpl, ReadTextFileImpl } from '../codex/runtime-config.js';

export type CodexProviderId = 'openai-codex';
export type FlueCodexModelId = `${CodexProviderId}/${string}`;

export interface CodexProviderAuthOptions {
	path?: string | undefined;
	codexHome?: string | undefined;
	env?: NodeJS.ProcessEnv | undefined;
}

export interface CodexProviderRuntimeOptions {
	baseUrl?: string | undefined;
	clientVersion?: string | undefined;
	codexHome?: string | undefined;
	env?: NodeJS.ProcessEnv | undefined;
}

export interface CodexProviderRefreshOptions {
	force?: boolean | undefined;
	skewMs?: number | undefined;
	proactiveMs?: number | undefined;
	now?: Date | undefined;
	tokenUrl?: string | undefined;
	clientId?: string | undefined;
	signal?: AbortSignal | undefined;
}

export interface CodexProviderModelDiscoveryOptions {
	signal?: AbortSignal | undefined;
}

export interface CodexProviderTimeoutOptions {
	fetchMs?: number | undefined;
	refreshMs?: number | undefined;
	runtimeCommandMs?: number | undefined;
}

export interface CodexProviderOptions {
	auth?: CodexProviderAuthOptions | undefined;
	runtime?: CodexProviderRuntimeOptions | undefined;
	refresh?: CodexProviderRefreshOptions | undefined;
	models?: CodexProviderModelDiscoveryOptions | undefined;
	timeouts?: CodexProviderTimeoutOptions | undefined;
}

export type CreateCodexProviderDefinitionOptions = CodexProviderOptions;
export type RegisterCodexProviderOptions = CodexProviderOptions;

export interface CodexProviderMetadata {
	providerId: CodexProviderId;
	models: CodexDiscoveredModel[];
	codexModelIds: string[];
	defaultCodexModelId: string;
	modelIds: FlueCodexModelId[];
	defaultModelId: FlueCodexModelId;
	authPath: string;
	refreshed: boolean;
}

export interface CodexProviderDefinition extends CodexProviderMetadata {
	registration: HttpProviderRegistration;
}

export type CodexProviderRegistrationResult = CodexProviderMetadata;

export interface CodexProviderDependencies {
	fetchImpl?: typeof fetch | undefined;
	execFileImpl?: ExecFileImpl | undefined;
	readFileImpl?: ReadTextFileImpl | undefined;
}

export interface CodexProviderRegistrationDependencies extends CodexProviderDependencies {
	registerProviderImpl?: ((providerId: string, registration: HttpProviderRegistration) => void) | undefined;
}
