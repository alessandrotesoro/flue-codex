import { defineAgent } from '@flue/runtime';
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

    const session = await harness.session();
    const response = (await withTimeout(
      session.prompt(prompt, {
        textVerbosity: 'low',
        tools: [],
      } as never),
      options.timeoutMs ?? DEFAULT_CODEX_LIVE_SMOKE_TIMEOUT_MS,
    )) as { text?: unknown };

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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;

  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Live Flue smoke test timed out after ${timeoutMs}ms.`)), timeoutMs);
    timer.unref?.();
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
