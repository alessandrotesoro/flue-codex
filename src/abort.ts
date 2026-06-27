export interface AbortSignalBundle {
	signal?: AbortSignal | undefined;
	cleanup: () => void;
}

export function composeAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignalBundle {
	const activeSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
	if (activeSignals.length === 0) return { cleanup: noop };
	if (activeSignals.length === 1) return { signal: activeSignals[0], cleanup: noop };
	if (typeof AbortSignal.any === 'function') return { signal: AbortSignal.any(activeSignals), cleanup: noop };

	const controller = new AbortController();
	const abort = () => {
		if (!controller.signal.aborted) controller.abort();
	};

	for (const signal of activeSignals) {
		if (signal.aborted) {
			abort();
			break;
		}
		signal.addEventListener('abort', abort, { once: true });
	}

	return {
		signal: controller.signal,
		cleanup: () => {
			for (const signal of activeSignals) signal.removeEventListener('abort', abort);
		},
	};
}

export function timeoutSignalBundle(ms: number, reason?: unknown): AbortSignalBundle {
	if (!Number.isFinite(ms) || ms <= 0) return { cleanup: noop };

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(reason), ms);
	timer.unref?.();

	return {
		signal: controller.signal,
		cleanup: () => clearTimeout(timer),
	};
}

export async function withAbortSignal<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
	if (!signal) return operation;
	if (signal.aborted) throw abortReason(signal);

	return await new Promise<T>((resolve, reject) => {
		const abort = () => reject(abortReason(signal));
		signal.addEventListener('abort', abort, { once: true });
		operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
}

function abortReason(signal: AbortSignal): unknown {
	return signal.reason ?? new Error('Operation aborted.');
}

function noop(): void {}
