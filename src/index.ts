export { createCodexProvider } from './provider/create-provider.js';
export { registerCodexProvider } from './provider/register-provider.js';
export type {
  CodexProviderDefinition,
  CodexProviderRegistrationResult,
  CreateCodexProviderOptions,
  RegisterCodexProviderOptions,
} from './provider/types.js';

export { doctorCodexProvider } from './diagnostics/doctor.js';
export { runCodexLiveSmoke } from './diagnostics/smoke.js';
export type { DoctorCodexProviderOptions } from './diagnostics/doctor.js';
export type { RunCodexLiveSmokeOptions } from './diagnostics/smoke.js';
export type {
  CodexDoctorReport,
  CodexDoctorStep,
  CodexLiveSmokeReport,
} from './diagnostics/report.js';

export { discoverCodexModels, modelOverridesForFlue, normalizeCodexModel, selectDefaultCodexModel } from './codex/models.js';
export type { CodexDiscoveredModel, DiscoverCodexModelsOptions, RawCodexModel } from './codex/types.js';

export { resolveCodexCredentials } from './auth/resolve-credentials.js';
export { readCodexAuthFile, resolveCodexAuthPath } from './auth/auth-file.js';
export { getJwtCodexAccountId, getJwtExpiration, decodeJwtPayload } from './auth/jwt.js';
export type { CodexAuthJson, CodexOAuthCredentials, ResolveCodexCredentialsOptions } from './auth/types.js';

export { FlueCodexError, isFlueCodexError } from './errors.js';
export type { FlueCodexErrorCode } from './errors.js';
