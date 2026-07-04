import { describe, expect, it } from 'vitest';
import { runCodexLiveSmoke } from '../src/diagnostics/index.js';
import { registerCodexProvider } from '../src/index.js';

describe('live smoke', () => {
	it.runIf(process.env.FLUE_CODEX_LIVE_SMOKE === '1')(
		'runs a tiny Flue completion with local Codex auth',
		async () => {
			const registration = await registerCodexProvider();
			const smoke = await runCodexLiveSmoke({ model: registration.defaultModelId });

			expect(smoke.ok).toBe(true);
		},
		30_000,
	);
});
