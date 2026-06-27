import { describe, expect, it, vi } from 'vitest';
import { doctorCodexProvider } from '../src/index.js';
import { makeAuth, makeTempAuth, mockJsonFetch } from './helpers.js';

describe('doctor', () => {
	it('reports auth, models, provider, and skipped live smoke', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		const fetchImpl = mockJsonFetch({
			models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true, is_default: true }],
		});

		const report = await doctorCodexProvider({ authPath, fetchImpl });

		expect(report.ok).toBe(true);
		expect(report.modelCount).toBe(1);
		expect(report.defaultModel).toBe('gpt-test');
		expect(report.steps.map((step) => [step.name, step.status])).toContainEqual(['live-smoke', 'skip']);
	});

	it('registers the provider before running requested live smoke', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		const fetchImpl = mockJsonFetch({
			models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true, is_default: true }],
		});
		const registerProviderImpl = vi.fn();
		const liveSmokeImpl = vi.fn(async () => ({ ok: true, model: 'openai-codex/gpt-test', text: '{"ok":true}' }));

		const report = await doctorCodexProvider({
			authPath,
			fetchImpl,
			liveSmoke: true,
			registerProviderImpl,
			liveSmokeImpl,
			liveSmokeTimeoutMs: 100,
		});

		expect(report.ok).toBe(true);
		expect(registerProviderImpl).toHaveBeenCalledWith(
			'openai-codex',
			expect.objectContaining({ apiKey: expect.any(String), baseUrl: expect.any(String) }),
		);
		expect(liveSmokeImpl).toHaveBeenCalledWith(
			expect.objectContaining({ model: 'openai-codex/gpt-test', timeoutMs: 100 }),
		);
		expect(report.steps.map((step) => [step.name, step.status])).toContainEqual(['live-smoke', 'pass']);
	});

	it('reports live smoke failure without throwing', async () => {
		const { authPath } = await makeTempAuth(makeAuth());
		const fetchImpl = mockJsonFetch({
			models: [{ slug: 'gpt-test', visibility: 'list', supported_in_api: true, is_default: true }],
		});

		const report = await doctorCodexProvider({
			authPath,
			fetchImpl,
			liveSmoke: true,
			registerProviderImpl: vi.fn(),
			liveSmokeImpl: async () => ({ ok: false, model: 'openai-codex/gpt-test', message: 'nope' }),
		});

		expect(report.ok).toBe(false);
		expect(report.steps.map((step) => [step.name, step.status])).toContainEqual(['live-smoke', 'fail']);
	});

	it('returns a failed report instead of throwing', async () => {
		const report = await doctorCodexProvider({ authPath: '/tmp/not-real/flue-codex-auth.json' });

		expect(report.ok).toBe(false);
		expect(report.steps.at(-1)).toMatchObject({ status: 'fail', code: 'missing_auth' });
	});
});
