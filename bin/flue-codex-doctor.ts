#!/usr/bin/env node
import { doctorCodexProvider } from '../src/diagnostics/doctor.js';

async function main(): Promise<void> {
  const liveSmoke = process.argv.includes('--live') || process.env.FLUE_CODEX_LIVE_SMOKE === '1';
  const report = await doctorCodexProvider({ liveSmoke });

  await writeOutput(process.stdout, `${JSON.stringify(report, null, 2)}\n`);
  process.exit(report.ok ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  void writeOutput(process.stderr, `${message}\n`).finally(() => process.exit(1));
});

function writeOutput(stream: NodeJS.WriteStream, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.write(value, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
