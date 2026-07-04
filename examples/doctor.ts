import { doctorCodexProvider } from '@sematico/flue-codex/diagnostics';

const report = await doctorCodexProvider({
	diagnostics: {
		liveSmoke: { enabled: process.env.FLUE_CODEX_LIVE_SMOKE === '1' },
	},
});

console.log(JSON.stringify(report, null, 2));
