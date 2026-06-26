import { describe, expect, it, vi } from 'vitest';
import { createCodexProvider, registerCodexProvider } from '../src/index.js';
import { makeAuth, makeTempAuth, jsonResponse } from './helpers.js';

describe('Flue provider construction', () => {
  it('creates an openai-codex provider definition from local auth and live model discovery', async () => {
    const { authPath } = await makeTempAuth(makeAuth());
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true, context_window: 2048 }],
      }),
    ) as unknown as typeof fetch;

    const definition = await createCodexProvider({ authPath, fetchImpl });

    expect(definition.providerId).toBe('openai-codex');
    expect(definition.defaultModel).toBe('gpt-test');
    expect(definition.registration).toMatchObject({
      api: 'openai-codex-responses',
      baseUrl: '[redacted-codex-backend-url]',
      models: { 'gpt-test': { contextWindow: 2048 } },
    });
    expect(definition.registration.headers).toBeUndefined();
  });

  it('registers the provider with Flue through an injectable registration function', async () => {
    const { authPath } = await makeTempAuth(makeAuth());
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true }] }),
    ) as unknown as typeof fetch;
    const registerProviderImpl = vi.fn();

    const result = await registerCodexProvider({ authPath, fetchImpl, registerProviderImpl });

    expect(result.providerId).toBe('openai-codex');
    expect(result.modelIds).toEqual(['gpt-test']);
    expect(registerProviderImpl).toHaveBeenCalledWith(
      'openai-codex',
      expect.objectContaining({ apiKey: expect.any(String), api: 'openai-codex-responses' }),
    );
  });

  it('wraps Flue provider registration failures', async () => {
    const { authPath } = await makeTempAuth(makeAuth());
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true }] }),
    ) as unknown as typeof fetch;

    await expect(
      registerCodexProvider({
        authPath,
        fetchImpl,
        registerProviderImpl: () => {
          throw new Error('registry refused');
        },
      }),
    ).rejects.toMatchObject({ code: 'provider_registration_failed' });
  });
});
