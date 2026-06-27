import type { CodexDiscoveredModel } from './codex.types.js';

export function modelOverridesForFlue(
	models: CodexDiscoveredModel[],
): Record<string, { contextWindow?: number; maxTokens?: number }> {
	return Object.fromEntries(
		models.map((model) => [
			model.id,
			{
				...(model.contextWindow !== undefined ? { contextWindow: model.contextWindow } : {}),
				...(model.maxTokens !== undefined ? { maxTokens: model.maxTokens } : {}),
			},
		]),
	);
}
