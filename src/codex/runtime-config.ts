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
	execFileImpl?: ExecFileImpl | undefined;
	readFileImpl?: ReadTextFileImpl | undefined;
	runtimeCommandTimeoutMs?: number | undefined;
}

export type ExecFileImpl = (
	file: string,
	args: readonly string[],
	options: { env: NodeJS.ProcessEnv; timeout: number; windowsHide: boolean },
) => Promise<{ stdout: string; stderr: string }>;

export type ReadTextFileImpl = (path: string, encoding: BufferEncoding) => Promise<string>;

const DEFAULT_RUNTIME_COMMAND_TIMEOUT_MS = 15_000;

export async function resolveCodexRuntimeConfig(
	options: CodexRuntimeConfigOptions = {},
): Promise<CodexRuntimeConfig> {
	const [baseUrl, clientVersion] = await Promise.all([
		resolveCodexBackendBaseUrl(options),
		resolveCodexClientVersion(options),
	]);

	return { baseUrl, clientVersion };
}

export async function resolveCodexClientVersion(options: CodexRuntimeConfigOptions = {}): Promise<string> {
	const env = options.env ?? process.env;
	const explicit = nonEmptyString(options.clientVersion) ?? nonEmptyString(env.CODEX_CLIENT_VERSION);
	if (explicit) return explicit;

	const codexHome = resolveCodexHome(options);
	const cached = await readCachedClientVersion(codexHome, options);
	if (cached) return cached;

	const output = await runCodexCommand(['--version'], options).catch(() => undefined);
	const version = output ? parseCodexVersion(output.stdout || output.stderr) : undefined;
	if (version) return version;

	throw new FlueCodexError(
		'runtime_metadata_unavailable',
		'Unable to infer the installed Codex client version. Run `codex --version` or pass clientVersion explicitly.',
	);
}

export async function resolveCodexBackendBaseUrl(options: CodexRuntimeConfigOptions = {}): Promise<string> {
	const env = options.env ?? process.env;
	const explicit = nonEmptyString(options.baseUrl) ?? nonEmptyString(env.CODEX_API_BASE_URL);
	if (explicit) return normalizeCodexBackendBaseUrl(explicit);

	const doctor = await runCodexCommand(['doctor', '--json', '--summary', '--no-color', '--ascii'], options).catch(
		() => undefined,
	);
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

function readCachedClientVersion(
	codexHome: string,
	options: Pick<CodexRuntimeConfigOptions, 'readFileImpl'>,
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
	options: Pick<CodexRuntimeConfigOptions, 'env' | 'execFileImpl' | 'runtimeCommandTimeoutMs'>,
): Promise<{ stdout: string; stderr: string }> {
	const exec = options.execFileImpl ?? defaultExecFile;
	return exec('codex', args, {
		env: commandEnv(options.env),
		timeout: options.runtimeCommandTimeoutMs ?? DEFAULT_RUNTIME_COMMAND_TIMEOUT_MS,
		windowsHide: true,
	}).catch((error: unknown) => {
		const output = commandOutputFromError(error);
		if (output) return output;
		throw error;
	});
}

function commandEnv(env: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
	return env ? { ...process.env, ...env } : process.env;
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
