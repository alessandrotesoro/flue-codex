import type { HttpProviderRegistration } from '@flue/runtime';
import type { CodexDiscoveredModel, DiscoverCodexModelsOptions } from '../codex/codex.types.js';
import type { ResolveCodexCredentialsOptions } from '../auth/auth.types.js';

export interface CreateCodexProviderOptions
	extends Omit<ResolveCodexCredentialsOptions, 'fetchImpl'>,
		Partial<Pick<DiscoverCodexModelsOptions, 'baseUrl' | 'clientVersion' | 'timeoutMs'>> {
	fetchImpl?: typeof fetch | undefined;
}

export interface CodexProviderDefinition {
	providerId: 'openai-codex';
	registration: HttpProviderRegistration;
	models: CodexDiscoveredModel[];
	modelIds: string[];
	defaultModel: string;
	authPath: string;
	refreshed: boolean;
}

export interface RegisterCodexProviderOptions extends CreateCodexProviderOptions {
	registerProviderImpl?: ((providerId: string, registration: HttpProviderRegistration) => void) | undefined;
}

export type CodexProviderRegistrationResult = Omit<CodexProviderDefinition, 'registration'>;
