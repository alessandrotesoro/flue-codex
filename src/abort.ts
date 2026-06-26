export interface AbortSignalBundle {
  signal?: AbortSignal | undefined;
  cleanup: () => void;
}

export function composeAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignalBundle {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal !== undefined);
  if (activeSignals.length === 0) return { cleanup: noop };
  if (activeSignals.length === 1) return { signal: activeSignals[0], cleanup: noop };

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

export function timeoutSignal(ms: number): AbortSignal | undefined {
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);

  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms).unref?.();
  return controller.signal;
}

function noop(): void {}
