import { describe, expect, it } from 'vitest';
import { groupPendingItems } from './utils';
import { mockPendingItems } from './mock-data';

describe('groupPendingItems', () => {
  it('groups items by project priority then severity', () => {
    const groups = groupPendingItems(mockPendingItems);

    expect(groups[0].projectName).toBe('wanman.ai iOS App');
    expect(groups[0].items[0].severity).toBe('heavy');
    expect(groups[1].projectPriority).toBe('P1');
  });
});
