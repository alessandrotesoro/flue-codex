import { registerProvider } from '@flue/runtime';
import { FlueCodexError } from '../errors.js';
import { createCodexProvider } from './create-provider.js';
import type { CodexProviderRegistrationResult, RegisterCodexProviderOptions } from './types.js';

export async function registerCodexProvider(
	options: RegisterCodexProviderOptions = {},
): Promise<CodexProviderRegistrationResult> {
	const definition = await createCodexProvider(options);
	const register = options.registerProviderImpl ?? registerProvider;

	try {
		register(definition.providerId, definition.registration);
	} catch (error) {
		throw new FlueCodexError('provider_registration_failed', 'Flue rejected the Codex provider registration.', {
			cause: error,
		});
	}

	const { registration: _registration, ...result } = definition;
	return result;
}
