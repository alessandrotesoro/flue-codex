import { describe, expect, it } from 'vitest';
import { assessTokenFreshness } from '../src/auth/token-freshness.js';
import { makeAccessToken, makeAuth, makeJwt } from './helpers.js';

describe('token freshness', () => {
	it('treats a future token as fresh', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const token = makeAccessToken('acct', Math.floor(now.getTime() / 1000) + 3600);

		expect(assessTokenFreshness(token, makeAuth(), { now }).reason).toBe('fresh');
	});

	it('refreshes expired tokens', () => {
		const now = new Date('2026-01-01T00:00:00Z');
		const token = makeAccessToken('acct', Math.floor(now.getTime() / 1000) - 1);

		expect(assessTokenFreshness(token, makeAuth(), { now })).toMatchObject({
			shouldRefresh: true,
			reason: 'expired',
		});
	});

	it('refreshes tokens without exp', () => {
		const token = makeJwt({ 'https://api.openai.com/auth': { chatgpt_account_id: 'acct' } });

		expect(assessTokenFreshness(token, makeAuth()).reason).toBe('missing-exp');
	});
});
