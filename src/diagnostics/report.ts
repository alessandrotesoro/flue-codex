import type { FlueCodexErrorCode } from '../errors.js';

export type CodexDoctorStepStatus = 'pass' | 'fail' | 'skip';

export interface CodexDoctorStep {
  name: string;
  status: CodexDoctorStepStatus;
  message?: string | undefined;
  code?: FlueCodexErrorCode | undefined;
}

export interface CodexDoctorReport {
  ok: boolean;
  authPath?: string | undefined;
  accountIdPresent: boolean;
  refreshed: boolean;
  modelCount: number;
  defaultModel?: string | undefined;
  liveSmoke?: CodexLiveSmokeReport | undefined;
  steps: CodexDoctorStep[];
}

export interface CodexLiveSmokeReport {
  ok: boolean;
  model: string;
  text?: string | undefined;
  message?: string | undefined;
}
