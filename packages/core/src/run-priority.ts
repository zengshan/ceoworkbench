import type { MessageKind, RunKind } from './types';

export const RUN_PRIORITIES: Record<RunKind, number> = {
  ceo_steer: 100,
  ceo_decision: 90,
  recovery: 80,
  continuation: 50,
  reflection: 10,
};

export function getRunPriority(kind: RunKind) {
  return RUN_PRIORITIES[kind];
}

export function getRunKindForMessage(kind: MessageKind): RunKind {
  if (kind === 'decision') {
    return 'ceo_decision';
  }

  if (kind === 'follow_up') {
    return 'continuation';
  }

  return 'ceo_steer';
}
