import { registerProvider } from '@flue/runtime';
import { selectDefaultCodexModel } from '../codex/models.js';
import { OPENAI_CODEX_PROVIDER_ID } from '../constants.js';
import { errorToReportMessage, isFlueCodexError } from '../errors.js';
import { buildCodexProviderDefinition, resolveCodexProviderInputs } from '../provider/create-provider.js';
import { runCodexLiveSmoke } from './smoke.js';
import type { CodexDoctorReport, CodexDoctorStep, CodexLiveSmokeReport } from './report.js';

export interface DoctorCodexProviderOptions {
	authPath?: string | undefined;
	codexHome?: string | undefined;
	env?: NodeJS.ProcessEnv | undefined;
	forceRefresh?: boolean | undefined;
	baseUrl?: string | undefined;
	clientVersion?: string | undefined;
	timeoutMs?: number | undefined;
	fetchImpl?: typeof fetch | undefined;
	liveSmoke?: boolean | undefined;
	liveSmokeModel?: string | undefined;
	liveSmokePrompt?: string | undefined;
	liveSmokeTimeoutMs?: number | undefined;
	cwd?: string | undefined;
	registerProviderImpl?: typeof registerProvider | undefined;
	liveSmokeImpl?: ((options: Parameters<typeof runCodexLiveSmoke>[0]) => Promise<CodexLiveSmokeReport>) | undefined;
}

export async function doctorCodexProvider(options: DoctorCodexProviderOptions = {}): Promise<CodexDoctorReport> {
	const steps: CodexDoctorStep[] = [];
	let authPath: string | undefined;
	let refreshed = false;
	let accountIdPresent = false;
	let modelCount = 0;
	let defaultModel: string | undefined;

	try {
		const { credentials, models, baseUrl } = await resolveCodexProviderInputs(options);
		authPath = credentials.authPath;
		refreshed = credentials.refreshed;
		accountIdPresent = credentials.accountId.length > 0;
		steps.push({
			name: 'auth',
			status: 'pass',
			message: refreshed ? 'Codex auth loaded and refreshed.' : 'Codex auth loaded.',
		});

		modelCount = models.length;
		defaultModel = selectDefaultCodexModel(models);
		steps.push({ name: 'models', status: 'pass', message: `Discovered ${models.length} usable Codex model(s).` });

		const definition = buildCodexProviderDefinition({ credentials, models, baseUrl });
		steps.push({
			name: 'provider',
			status: 'pass',
			message: `${OPENAI_CODEX_PROVIDER_ID} provider definition can be created.`,
		});

		let liveSmoke: CodexLiveSmokeReport | undefined;
		if (options.liveSmoke) {
			const register = options.registerProviderImpl ?? registerProvider;
			register(definition.providerId, definition.registration);
			const smokeModel = `${OPENAI_CODEX_PROVIDER_ID}/${options.liveSmokeModel ?? defaultModel}`;
			liveSmoke = await (options.liveSmokeImpl ?? runCodexLiveSmoke)({
				model: smokeModel,
				prompt: options.liveSmokePrompt,
				timeoutMs: options.liveSmokeTimeoutMs,
				cwd: options.cwd,
			});
			steps.push({
				name: 'live-smoke',
				status: liveSmoke.ok ? 'pass' : 'fail',
				message: liveSmoke.ok ? 'Live Flue completion succeeded.' : liveSmoke.message,
			});
		} else {
			steps.push({ name: 'live-smoke', status: 'skip', message: 'Live completion was not requested.' });
		}

		return {
			ok: steps.every((step) => step.status !== 'fail'),
			authPath,
			accountIdPresent,
			refreshed,
			modelCount,
			defaultModel,
			liveSmoke,
			steps,
		};
	} catch (error) {
		steps.push({
			name: 'doctor',
			status: 'fail',
			code: isFlueCodexError(error) ? error.code : undefined,
			message: errorToReportMessage(error),
		});
		return {
			ok: false,
			authPath,
			accountIdPresent,
			refreshed,
			modelCount,
			defaultModel,
			steps,
		};
	}
}
