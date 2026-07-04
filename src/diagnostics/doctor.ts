import { registerProvider } from '@flue/runtime';
import { errorToReportMessage, isFlueCodexError } from '../support/flue-codex-error.js';
import { buildCodexProviderDefinition, resolveCodexProviderInputs } from '../provider/create-provider.js';
import { runCodexLiveSmokeWithDependencies } from './smoke.js';
import type { CodexDoctorReport, CodexDoctorStep, CodexLiveSmokeReport } from './report.js';
import type { CodexProviderOptions, CodexProviderRegistrationDependencies } from '../provider/provider.types.js';
import type { RunCodexLiveSmokeDependencies, RunCodexLiveSmokeOptions } from './smoke.js';

export interface DoctorCodexProviderOptions extends CodexProviderOptions {
	diagnostics?: CodexDoctorDiagnosticsOptions | undefined;
}

export interface CodexDoctorDiagnosticsOptions {
	liveSmoke?: CodexDoctorLiveSmokeOptions | undefined;
}

export interface CodexDoctorLiveSmokeOptions {
	enabled?: boolean | undefined;
	modelId?: string | undefined;
	prompt?: string | undefined;
	timeoutMs?: number | undefined;
	cwd?: string | undefined;
}

export interface DoctorCodexProviderDependencies
	extends CodexProviderRegistrationDependencies,
		RunCodexLiveSmokeDependencies {
	liveSmokeImpl?: ((options: RunCodexLiveSmokeOptions) => Promise<CodexLiveSmokeReport>) | undefined;
}

export async function doctorCodexProvider(options: DoctorCodexProviderOptions = {}): Promise<CodexDoctorReport> {
	return doctorCodexProviderWithDependencies(options);
}

export async function doctorCodexProviderWithDependencies(
	options: DoctorCodexProviderOptions = {},
	dependencies: DoctorCodexProviderDependencies = {},
): Promise<CodexDoctorReport> {
	const steps: CodexDoctorStep[] = [];
	let authPath: string | undefined;
	let refreshed = false;
	let accountIdPresent = false;
	let modelCount = 0;
	let defaultModelId: string | undefined;
	let defaultCodexModelId: string | undefined;

	try {
		const { credentials, models, baseUrl } = await resolveCodexProviderInputs(options, dependencies);
		authPath = credentials.authPath;
		refreshed = credentials.refreshed;
		accountIdPresent = credentials.accountId.length > 0;
		steps.push({
			name: 'auth',
			status: 'pass',
			message: refreshed ? 'Codex auth loaded and refreshed.' : 'Codex auth loaded.',
		});

		modelCount = models.length;
		steps.push({ name: 'models', status: 'pass', message: `Discovered ${models.length} usable Codex model(s).` });

		const definition = buildCodexProviderDefinition({ credentials, models, baseUrl });
		defaultModelId = definition.defaultModelId;
		defaultCodexModelId = definition.defaultCodexModelId;
		steps.push({
			name: 'provider',
			status: 'pass',
			message: `${definition.providerId} provider definition can be created.`,
		});

		let liveSmoke: CodexLiveSmokeReport | undefined;
		const liveSmokeOptions = options.diagnostics?.liveSmoke;
		if (liveSmokeOptions?.enabled) {
			const register = dependencies.registerProviderImpl ?? registerProvider;
			register(definition.providerId, definition.registration);

			const smokeInput = {
				model: liveSmokeOptions.modelId ?? definition.defaultModelId,
				prompt: liveSmokeOptions.prompt,
				timeoutMs: liveSmokeOptions.timeoutMs,
				cwd: liveSmokeOptions.cwd,
			};
			liveSmoke = dependencies.liveSmokeImpl
				? await dependencies.liveSmokeImpl(smokeInput)
				: await runCodexLiveSmokeWithDependencies(smokeInput, dependencies);
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
			defaultModelId,
			defaultCodexModelId,
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
			defaultModelId,
			defaultCodexModelId,
			steps,
		};
	}
}
