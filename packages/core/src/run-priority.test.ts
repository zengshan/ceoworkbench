import { describe, expect, it } from 'vitest';
import { getRunKindForMessage, getRunPriority } from './run-priority';

describe('run priority', () => {
  it('prioritizes CEO steer above normal continuation work', () => {
    expect(getRunPriority('ceo_steer')).toBeGreaterThan(getRunPriority('continuation'));
  });

  it('prioritizes recovery above manager continuation work', () => {
    expect(getRunPriority('recovery')).toBeGreaterThan(getRunPriority('continuation'));
  });

  it('maps message kinds into scheduler run kinds', () => {
    expect(getRunKindForMessage('steer')).toBe('ceo_steer');
    expect(getRunKindForMessage('decision')).toBe('ceo_decision');
    expect(getRunKindForMessage('follow_up')).toBe('continuation');
    expect(getRunKindForMessage('report')).toBe('ceo_steer');
  });
});
