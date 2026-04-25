import { describe, expect, it } from 'vitest';
import { canLeaseRun, canRecoverRun, isTerminalRunStatus } from './run-status';

describe('run status helpers', () => {
  it('treats completed, failed, blocked, and cancelled as terminal states', () => {
    expect(isTerminalRunStatus('completed')).toBe(true);
    expect(isTerminalRunStatus('failed')).toBe(true);
    expect(isTerminalRunStatus('blocked')).toBe(true);
    expect(isTerminalRunStatus('cancelled')).toBe(true);
    expect(isTerminalRunStatus('running')).toBe(false);
  });

  it('leases only queued or retrying work', () => {
    expect(canLeaseRun('queued')).toBe(true);
    expect(canLeaseRun('retrying')).toBe(true);
    expect(canLeaseRun('running')).toBe(false);
    expect(canLeaseRun('completed')).toBe(false);
  });

  it('recovers only runs that may have been orphaned mid-lease or mid-run', () => {
    expect(canRecoverRun('leasing')).toBe(true);
    expect(canRecoverRun('running')).toBe(true);
    expect(canRecoverRun('queued')).toBe(false);
    expect(canRecoverRun('failed')).toBe(false);
  });
});
