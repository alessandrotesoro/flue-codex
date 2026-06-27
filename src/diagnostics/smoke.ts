import { defineAgent } from '@flue/runtime';
import { timeoutSignalBundle, withAbortSignal } from '../abort.js';
import { DEFAULT_CODEX_LIVE_SMOKE_TIMEOUT_MS } from '../constants.js';
import { errorToReportMessage } from '../errors.js';
import type { CodexLiveSmokeReport } from './report.js';

export interface RunCodexLiveSmokeOptions {
	model: string;
	prompt?: string | undefined;
	cwd?: string | undefined;
	timeoutMs?: number | undefined;
	runtimeLoader?: (() => Promise<FlueSmokeRuntime>) | undefined;
}

export interface FlueSmokeRuntime {
	createFlueContext: (options: unknown) => FlueSmokeContext;
	InMemorySessionStore: new () => unknown;
	resolveModel: unknown;
	local: (options: { cwd: string }) => { createSessionEnv: () => Promise<never> };
}

interface FlueSmokeContext {
	initializeRootHarness: (agent: unknown) => Promise<FlueSmokeHarness>;
}

interface FlueSmokeHarness {
	session: () => Promise<FlueSmokeSession>;
}

interface FlueSmokeSession {
	prompt: (prompt: string, options: unknown) => Promise<{ text?: unknown }>;
}

export async function runCodexLiveSmoke(options: RunCodexLiveSmokeOptions): Promise<CodexLiveSmokeReport> {
	const prompt = options.prompt ?? 'Reply with exactly this JSON and no markdown: {"ok":true}';

	try {
		const timeoutMs = options.timeoutMs ?? DEFAULT_CODEX_LIVE_SMOKE_TIMEOUT_MS;
		const timeout = timeoutSignalBundle(
			timeoutMs,
			new Error(`Live Flue smoke test timed out after ${timeoutMs}ms.`),
		);
		let response: { text?: unknown };
		try {
			const { createFlueContext, InMemorySessionStore, resolveModel, local } = await withAbortSignal(
				(options.runtimeLoader ?? loadFlueSmokeRuntime)(),
				timeout.signal,
			);

			const context = createFlueContext({
				id: 'flue-codex-smoke',
				env: {},
				agentConfig: { resolveModel },
				createDefaultEnv: async () => await local({ cwd: options.cwd ?? process.cwd() }).createSessionEnv(),
				defaultStore: new InMemorySessionStore(),
			});

			const harness = await withAbortSignal(
				context.initializeRootHarness(
					defineAgent(() => ({
						model: options.model,
						instructions: 'You are a minimal smoke-test agent. Return only the requested final answer.',
					})),
				),
				timeout.signal,
			);

			const session = await withAbortSignal(harness.session(), timeout.signal);
			response = (await withAbortSignal(
				session.prompt(prompt, {
					textVerbosity: 'low',
					tools: [],
					signal: timeout.signal,
				} as never),
				timeout.signal,
			)) as { text?: unknown };
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

async function loadFlueSmokeRuntime(): Promise<FlueSmokeRuntime> {
	const [{ createFlueContext, InMemorySessionStore, resolveModel }, { local }] = await Promise.all([
		import('@flue/runtime/internal'),
		import('@flue/runtime/node'),
	]);

	return {
		createFlueContext: createFlueContext as FlueSmokeRuntime['createFlueContext'],
		InMemorySessionStore,
		resolveModel,
		local: local as unknown as FlueSmokeRuntime['local'],
	};
}
