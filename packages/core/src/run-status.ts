import type { RunStatus } from './types';

const TERMINAL_RUN_STATUSES = new Set<RunStatus>(['completed', 'failed', 'blocked', 'cancelled']);

export function isTerminalRunStatus(status: RunStatus) {
  return TERMINAL_RUN_STATUSES.has(status);
}

export function canLeaseRun(status: RunStatus) {
  return status === 'queued' || status === 'retrying';
}

export function canRecoverRun(status: RunStatus) {
  return status === 'leasing' || status === 'running';
}
