import type { CodexDiscoveredModel, RawCodexModel } from './codex.types.js';

export function normalizeCodexModel(raw: RawCodexModel): CodexDiscoveredModel | null {
	const id = firstString(raw.slug, raw.id, raw.model);
	if (!id) return null;
	if (raw.visibility !== 'list') return null;
	if (raw.supported_in_api === false) return null;

	return {
		id,
		...(typeof raw.display_name === 'string' ? { name: raw.display_name } : {}),
		...(typeof raw.context_window === 'number' && Number.isFinite(raw.context_window)
			? { contextWindow: raw.context_window }
			: {}),
		...(typeof raw.max_output_tokens === 'number' && Number.isFinite(raw.max_output_tokens)
			? { maxTokens: raw.max_output_tokens }
			: {}),
		isDefault: raw.is_default === true,
	};
}

export function selectDefaultCodexModel(models: CodexDiscoveredModel[]): string {
	return models.find((model) => model.isDefault)?.id ?? models[0]?.id ?? '';
}

function firstString(...values: unknown[]): string | undefined {
	return values.find((value): value is string => typeof value === 'string' && value.length > 0);
}
