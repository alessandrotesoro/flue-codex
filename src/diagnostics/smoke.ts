import { defineAgent } from '@flue/runtime';
import { timeoutSignalBundle } from '../abort.js';
import { DEFAULT_CODEX_LIVE_SMOKE_TIMEOUT_MS } from '../constants.js';
import { errorToReportMessage } from '../errors.js';
import type { CodexLiveSmokeReport } from './report.js';

export interface RunCodexLiveSmokeOptions {
  model: string;
  prompt?: string | undefined;
  cwd?: string | undefined;
  timeoutMs?: number | undefined;
}

export async function runCodexLiveSmoke(options: RunCodexLiveSmokeOptions): Promise<CodexLiveSmokeReport> {
  const prompt = options.prompt ?? 'Reply with exactly this JSON and no markdown: {"ok":true}';

  try {
    const [{ createFlueContext, InMemorySessionStore, resolveModel }, { local }] = await Promise.all([
      import('@flue/runtime/internal'),
      import('@flue/runtime/node'),
    ]);

    const context = createFlueContext({
      id: 'flue-codex-smoke',
      env: {},
      agentConfig: { resolveModel },
      createDefaultEnv: async () =>
        await ((local({ cwd: options.cwd ?? process.cwd() }) as { createSessionEnv: () => Promise<never> }).createSessionEnv()),
      defaultStore: new InMemorySessionStore(),
    });

    const harness = await context.initializeRootHarness(
      defineAgent(() => ({
        model: options.model,
        instructions: 'You are a minimal smoke-test agent. Return only the requested final answer.',
      })),
    );

    const timeoutMs = options.timeoutMs ?? DEFAULT_CODEX_LIVE_SMOKE_TIMEOUT_MS;
    const timeout = timeoutSignalBundle(timeoutMs, new Error(`Live Flue smoke test timed out after ${timeoutMs}ms.`));
    let response: { text?: unknown };
    try {
      const session = await harness.session();
      response = (await session.prompt(prompt, {
        textVerbosity: 'low',
        tools: [],
        signal: timeout.signal,
      } as never)) as { text?: unknown };
    } finally {
      timeout.cleanup();
    }

    return {
      ok: true,
      model: options.model,
      ...(typeof response.text === 'string' ? { text: response.text } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      model: options.model,
      message: errorToReportMessage(error),
    };
  }
}
