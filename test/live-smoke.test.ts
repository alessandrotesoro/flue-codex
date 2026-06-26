import { describe, expect, it } from 'vitest';
import { registerCodexProvider, runCodexLiveSmoke } from '../src/index.js';

describe('live smoke', () => {
  it.runIf(process.env.FLUE_CODEX_LIVE_SMOKE === '1')('runs a tiny Flue completion with local Codex auth', async () => {
    const registration = await registerCodexProvider();
    const smoke = await runCodexLiveSmoke({ model: `openai-codex/${registration.defaultModel}` });

    expect(smoke.ok).toBe(true);
  }, 30_000);
});
