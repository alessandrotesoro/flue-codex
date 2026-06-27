import { doctorCodexProvider } from '@sematico/flue-codex';

const report = await doctorCodexProvider({
  liveSmoke: process.env.FLUE_CODEX_LIVE_SMOKE === '1',
});

console.log(JSON.stringify(report, null, 2));
