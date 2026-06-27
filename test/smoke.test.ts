import { describe, expect, it, vi } from 'vitest';
import { runCodexLiveSmoke } from '../src/index.js';
import type { FlueSmokeRuntime } from '../src/diagnostics/smoke.js';

describe('runCodexLiveSmoke', () => {
  it('runs a deterministic smoke prompt through an injected runtime', async () => {
    const prompt = vi.fn(async () => ({ text: '{"ok":true}' }));
    const runtimeLoader = async () => fakeRuntime({ prompt });

    const report = await runCodexLiveSmoke({
      model: 'openai-codex/gpt-test',
      runtimeLoader,
    });

    expect(report).toMatchObject({
      ok: true,
      model: 'openai-codex/gpt-test',
      text: '{"ok":true}',
    });
    expect(prompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        tools: [],
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('returns a failed report when harness initialization exceeds timeout', async () => {
    const runtimeLoader = async () =>
      fakeRuntime({
        initializeRootHarness: () => new Promise(() => undefined),
      });

    const report = await runCodexLiveSmoke({
      model: 'openai-codex/gpt-test',
      runtimeLoader,
      timeoutMs: 1,
    });

    expect(report).toMatchObject({
      ok: false,
      model: 'openai-codex/gpt-test',
      message: expect.stringContaining('timed out'),
    });
  });

  it('returns a failed report when session creation exceeds timeout', async () => {
    const runtimeLoader = async () =>
      fakeRuntime({
        session: () => new Promise(() => undefined),
      });

    const report = await runCodexLiveSmoke({
      model: 'openai-codex/gpt-test',
      runtimeLoader,
      timeoutMs: 1,
    });

    expect(report.ok).toBe(false);
    expect(report.message).toContain('timed out');
  });
});

function fakeRuntime(
  overrides: {
    initializeRootHarness?: () => Promise<unknown>;
    session?: () => Promise<unknown>;
    prompt?: (prompt: string, options: unknown) => Promise<{ text?: unknown }>;
  } = {},
): FlueSmokeRuntime {
  const prompt = overrides.prompt ?? (async () => ({ text: '{"ok":true}' }));
  const session = overrides.session ?? (async () => ({ prompt }));
  const initializeRootHarness = overrides.initializeRootHarness ?? (async () => ({ session }));

  return {
    createFlueContext: () => ({ initializeRootHarness }) as never,
    InMemorySessionStore: class {},
    resolveModel: {},
    local: () => ({ createSessionEnv: async () => undefined as never }),
  };
}
