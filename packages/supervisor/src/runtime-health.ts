import type { RunEvent } from '../../core/src';

export const TRANSIENT_FAILURE_WINDOW_MS = 10 * 60 * 1000;
export const TRANSIENT_FAILURE_ESCALATION_THRESHOLD = 8;

export type RuntimeErrorClassification = 'transient' | 'persistent';

export function classifyRuntimeError(message: string): RuntimeErrorClassification {
  if (/\b(401|402|403)\b/.test(message) || /invalid api key|spending limit|permission/i.test(message)) {
    return 'persistent';
  }

  return 'transient';
}

export function shouldEscalateTransientFailure(events: RunEvent[], now: string) {
  const windowStart = Date.parse(now) - TRANSIENT_FAILURE_WINDOW_MS;
  const recentEvents = events.filter((event) => Date.parse(event.createdAt) >= windowStart);
  const lastSuccessAt = Math.max(
    0,
    ...recentEvents
      .filter((event) => event.type === 'run_completed')
      .map((event) => Date.parse(event.createdAt)),
  );
  const transientFailuresSinceSuccess = recentEvents.filter((event) => {
    if (event.type !== 'run_failed' || Date.parse(event.createdAt) < lastSuccessAt) {
      return false;
    }

    const errorMessage = typeof event.payload.errorMessage === 'string' ? event.payload.errorMessage : '';
    return classifyRuntimeError(errorMessage) === 'transient';
  });

  return transientFailuresSinceSuccess.length >= TRANSIENT_FAILURE_ESCALATION_THRESHOLD;
}
