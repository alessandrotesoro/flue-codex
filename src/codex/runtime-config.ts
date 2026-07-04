import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { FlueCodexError } from '../support/flue-codex-error.js';
import { isRecord } from '../support/is-record.js';
import { normalizeCodexBackendBaseUrl } from './http.js';

export interface CodexRuntimeConfig {
	baseUrl: string;
	clientVersion: string;
}

export interface CodexRuntimeConfigOptions {
	baseUrl?: string | undefined;
	clientVersion?: string | undefined;
	codexHome?: string | undefined;
	env?: NodeJS.ProcessEnv | undefined;
	runtimeCommandTimeoutMs?: number | undefined;
}

export interface CodexRuntimeConfigDependencies {
	execFileImpl?: ExecFileImpl | undefined;
	readFileImpl?: ReadTextFileImpl | undefined;
}

interface CodexRuntimeResolverOptions extends CodexRuntimeConfigOptions, CodexRuntimeConfigDependencies {}

export type ExecFileImpl = (
	file: string,
	args: readonly string[],
	options: { env: NodeJS.ProcessEnv; timeout: number; windowsHide: boolean },
) => Promise<{ stdout: string; stderr: string }>;

export type ReadTextFileImpl = (path: string, encoding: BufferEncoding) => Promise<string>;

const DEFAULT_RUNTIME_COMMAND_TIMEOUT_MS = 15_000;
const DEFAULT_DOCTOR_COMMAND_TIMEOUT_MS = 60_000;

export async function resolveCodexRuntimeConfig(options: CodexRuntimeConfigOptions = {}): Promise<CodexRuntimeConfig> {
	return resolveCodexRuntimeConfigWithDependencies(options);
}

export async function resolveCodexRuntimeConfigWithDependencies(
	options: CodexRuntimeConfigOptions = {},
	dependencies: CodexRuntimeConfigDependencies = {},
): Promise<CodexRuntimeConfig> {
	const [baseUrl, clientVersion] = await Promise.all([
		resolveCodexBackendBaseUrlWithDependencies(options, dependencies),
		resolveCodexClientVersionWithDependencies(options, dependencies),
	]);

	return { baseUrl, clientVersion };
}

export async function resolveCodexClientVersion(options: CodexRuntimeConfigOptions = {}): Promise<string> {
	return resolveCodexClientVersionWithDependencies(options);
}

export async function resolveCodexClientVersionWithDependencies(
	options: CodexRuntimeConfigOptions = {},
	dependencies: CodexRuntimeConfigDependencies = {},
): Promise<string> {
	const resolverOptions = toRuntimeResolverOptions(options, dependencies);
	const env = resolverOptions.env ?? process.env;
	const explicit = nonEmptyString(resolverOptions.clientVersion) ?? nonEmptyString(env.CODEX_CLIENT_VERSION);
	if (explicit) return explicit;

	const codexHome = resolveCodexHome(resolverOptions);
	const cached = await readCachedClientVersion(codexHome, resolverOptions);
	if (cached) return cached;

	const output = await runCodexCommand(['--version'], resolverOptions).catch(() => undefined);
	const version = output ? parseCodexVersion(output.stdout || output.stderr) : undefined;
	if (version) return version;

	throw new FlueCodexError(
		'runtime_metadata_unavailable',
		'Unable to infer the installed Codex client version. Run `codex --version` or pass clientVersion explicitly.',
	);
}

export async function resolveCodexBackendBaseUrl(options: CodexRuntimeConfigOptions = {}): Promise<string> {
	return resolveCodexBackendBaseUrlWithDependencies(options);
}

export async function resolveCodexBackendBaseUrlWithDependencies(
	options: CodexRuntimeConfigOptions = {},
	dependencies: CodexRuntimeConfigDependencies = {},
): Promise<string> {
	const resolverOptions = toRuntimeResolverOptions(options, dependencies);
	const env = resolverOptions.env ?? process.env;
	const explicit = nonEmptyString(resolverOptions.baseUrl) ?? nonEmptyString(env.CODEX_API_BASE_URL);
	if (explicit) return normalizeCodexBackendBaseUrl(explicit);

	const doctor = await runCodexCommand(
		['doctor', '--json', '--summary', '--no-color', '--ascii'],
		resolverOptions,
		DEFAULT_DOCTOR_COMMAND_TIMEOUT_MS,
	).catch(() => undefined);
	const baseUrl = doctor ? safeParseDoctorBackendBaseUrl(doctor.stdout) : undefined;
	if (baseUrl) return normalizeCodexBackendBaseUrl(baseUrl);

	throw new FlueCodexError(
		'runtime_metadata_unavailable',
		'Unable to infer the installed Codex backend URL. Run `codex doctor --json --summary` or pass baseUrl explicitly.',
	);
}

export function resolveCodexHome(options: Pick<CodexRuntimeConfigOptions, 'codexHome' | 'env'> = {}): string {
	const env = options.env ?? process.env;
	return options.codexHome ?? env.CODEX_HOME ?? join(homedir(), '.codex');
}

function toRuntimeResolverOptions(
	options: CodexRuntimeConfigOptions,
	dependencies: CodexRuntimeConfigDependencies,
): CodexRuntimeResolverOptions {
	return { ...options, ...dependencies };
}

function readCachedClientVersion(
	codexHome: string,
	options: Pick<CodexRuntimeResolverOptions, 'readFileImpl'>,
): Promise<string | undefined> {
	const reader = options.readFileImpl ?? readFile;
	return reader(join(codexHome, 'models_cache.json'), 'utf8')
		.then((raw) => {
			const parsed = JSON.parse(raw);
			return isRecord(parsed) ? nonEmptyString(parsed.client_version) : undefined;
		})
		.catch(() => undefined);
}

function runCodexCommand(
	args: readonly string[],
	options: Pick<CodexRuntimeResolverOptions, 'codexHome' | 'env' | 'execFileImpl' | 'runtimeCommandTimeoutMs'>,
	defaultTimeoutMs = DEFAULT_RUNTIME_COMMAND_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string }> {
	const exec = options.execFileImpl ?? defaultExecFile;
	return exec('codex', args, {
		env: commandEnv(options.env, options.codexHome),
		timeout: options.runtimeCommandTimeoutMs ?? defaultTimeoutMs,
		windowsHide: true,
	}).catch((error: unknown) => {
		const output = commandOutputFromError(error);
		if (output) return output;
		throw error;
	});
}

function commandEnv(env: NodeJS.ProcessEnv | undefined, codexHome: string | undefined): NodeJS.ProcessEnv {
	return codexHome ? { ...process.env, ...env, CODEX_HOME: codexHome } : { ...process.env, ...env };
}

function defaultExecFile(
	file: string,
	args: readonly string[],
	options: { env: NodeJS.ProcessEnv; timeout: number; windowsHide: boolean },
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		execFile(file, [...args], options, (error, stdout, stderr) => {
			if (error) {
				Object.assign(error, { stdout, stderr });
				reject(error);
				return;
			}

			resolve({ stdout, stderr });
		});
	});
}

function commandOutputFromError(error: unknown): { stdout: string; stderr: string } | undefined {
	if (!isRecord(error)) return undefined;
	const stdout = typeof error.stdout === 'string' ? error.stdout : '';
	const stderr = typeof error.stderr === 'string' ? error.stderr : '';
	return stdout.length > 0 || stderr.length > 0 ? { stdout, stderr } : undefined;
}

function parseCodexVersion(output: string): string | undefined {
	return output.match(/\b(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)\b/)?.[1];
}

function parseDoctorBackendBaseUrl(output: string): string | undefined {
	const parsed = JSON.parse(output);
	if (!isRecord(parsed) || !isRecord(parsed.checks)) return undefined;

	const reachability = parsed.checks['network.provider_reachability'];
	if (!isRecord(reachability) || !isRecord(reachability.details)) return undefined;

	const detail = reachability.details['ChatGPT base URL'];
	if (typeof detail !== 'string') return undefined;

	return detail.match(/https?:\/\/\S+/)?.[0];
}

function safeParseDoctorBackendBaseUrl(output: string): string | undefined {
	try {
		return parseDoctorBackendBaseUrl(output);
	} catch {
		return undefined;
	}
}

function nonEmptyString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}
