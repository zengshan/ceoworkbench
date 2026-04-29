import { describe, expect, it } from 'vitest';
import type { RunEvent } from '../../core/src';
import { classifyRuntimeError, shouldEscalateTransientFailure } from './runtime-health';

function event(id: string, type: RunEvent['type'], createdAt: string, errorMessage?: string): RunEvent {
  return {
    id,
    companyId: 'company-1',
    type,
    payload: errorMessage ? { errorMessage } : {},
    createdAt,
  };
}

describe('runtime health classification', () => {
  it('classifies non-retryable auth billing and permission errors as persistent', () => {
    expect(classifyRuntimeError('OpenAI Responses API failed with 402: Team weekly spending limit reached')).toBe('persistent');
    expect(classifyRuntimeError('OpenAI Responses API failed with 401: invalid API key')).toBe('persistent');
    expect(classifyRuntimeError('OpenAI Responses API failed with 403: permission denied')).toBe('persistent');
  });

  it('escalates transient failures after 8 failures in 10 minutes without success', () => {
    const failures = Array.from({ length: 8 }, (_, index) => event(
      `event-${index}`,
      'run_failed',
      `2026-04-25T00:0${index}:00.000Z`,
      'OpenAI Responses API failed with 429: rate limit',
    ));

    expect(shouldEscalateTransientFailure(failures, '2026-04-25T00:09:00.000Z')).toBe(true);
  });

  it('resets transient escalation after a successful run in the window', () => {
    const failures = Array.from({ length: 8 }, (_, index) => event(
      `event-${index}`,
      'run_failed',
      `2026-04-25T00:0${index}:00.000Z`,
      'OpenAI Responses API failed with 500: upstream error',
    ));
    const events = [
      ...failures.slice(0, 5),
      event('success', 'run_completed', '2026-04-25T00:05:30.000Z'),
      ...failures.slice(5),
    ];

    expect(shouldEscalateTransientFailure(events, '2026-04-25T00:09:00.000Z')).toBe(false);
  });
});
