import { describe, expect, it } from 'vitest';
import type { AgentContext } from './agent-adapter';
import { FakeManagerAdapter } from './fake-manager-adapter';

describe('FakeManagerAdapter', () => {
  it('emits a deterministic task, artifact, memory entry, and progress events', async () => {
    const adapter = new FakeManagerAdapter();
    const context: AgentContext = {
      run: {
        id: 'run-1',
        companyId: 'company-1',
        agentId: 'agent-manager',
        kind: 'ceo_steer',
        status: 'running',
        priority: 100,
        attempt: 0,
        maxAttempts: 3,
        queuedAt: '2026-04-25T00:00:00.000Z',
      },
      messages: [
        {
          id: 'message-1',
          companyId: 'company-1',
          agentId: 'agent-manager',
          author: 'ceo',
          kind: 'steer',
          content: '拆解小说出版项目',
          createdAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      recentEvents: [],
      activeTasks: [],
      artifacts: [],
      memoryEntries: [],
    };

    const result = await adapter.runStep(context);

    expect(result.events.map((event) => event.payload.eventKind)).toEqual(['ack', 'progress']);
    expect(result.tasks?.[0].objective).toContain('拆解小说出版项目');
    expect(result.artifacts?.[0].path).toBe('artifacts/run-1/project-plan.md');
    expect(result.memoryEntries?.[0].content).toBe('拆解小说出版项目');
  });

  it('requests a CEO decision when the steer needs confirmation', async () => {
    const adapter = new FakeManagerAdapter();
    const context: AgentContext = {
      run: {
        id: 'run-1',
        companyId: 'company-1',
        agentId: 'agent-manager',
        kind: 'ceo_steer',
        status: 'running',
        priority: 100,
        attempt: 0,
        maxAttempts: 3,
        queuedAt: '2026-04-25T00:00:00.000Z',
      },
      messages: [
        {
          id: 'message-1',
          companyId: 'company-1',
          agentId: 'agent-manager',
          author: 'ceo',
          kind: 'steer',
          content: '需要确认小说方向',
          createdAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      recentEvents: [],
      activeTasks: [],
      artifacts: [],
      memoryEntries: [],
    };

    const result = await adapter.runStep(context);

    expect(result.blocked).toBe(true);
    expect(result.decisionRequests?.[0]).toMatchObject({
      title: 'Confirm project direction',
      recommendedOptionId: 'B',
    });
  });

  it('delegates a historical novel CEO steer to specialist workers', async () => {
    const adapter = new FakeManagerAdapter();
    const context: AgentContext = {
      run: {
        id: 'run-1',
        companyId: 'company-1',
        agentId: 'agent-manager',
        kind: 'ceo_steer',
        status: 'running',
        priority: 100,
        attempt: 0,
        maxAttempts: 3,
        queuedAt: '2026-04-25T00:00:00.000Z',
      },
      messages: [
        {
          id: 'message-1',
          companyId: 'company-1',
          agentId: 'agent-manager',
          author: 'ceo',
          kind: 'steer',
          content: '我要创作一部历史小说',
          createdAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      recentEvents: [],
      activeTasks: [],
      artifacts: [],
      memoryEntries: [],
    };

    const result = await adapter.runStep(context);

    expect(result.delegations?.map((delegation) => delegation.agentName)).toEqual([
      'researcher',
      'architect',
      'writer',
      'editor',
    ]);
    expect(result.delegations?.[0]).toMatchObject({
      role: 'worker',
      capabilities: ['research', 'report'],
      objective: expect.stringContaining('历史小说'),
    });
  });

  it('does not request another CEO decision while processing a resolved decision', async () => {
    const adapter = new FakeManagerAdapter();
    const context: AgentContext = {
      run: {
        id: 'run-1',
        companyId: 'company-1',
        agentId: 'agent-manager',
        kind: 'ceo_decision',
        status: 'running',
        priority: 90,
        attempt: 0,
        maxAttempts: 3,
        queuedAt: '2026-04-25T00:00:00.000Z',
      },
      messages: [
        {
          id: 'message-1',
          companyId: 'company-1',
          agentId: 'agent-manager',
          author: 'ceo',
          kind: 'decision',
          content: 'Decision direction: B',
          createdAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      recentEvents: [],
      activeTasks: [],
      artifacts: [],
      memoryEntries: [],
    };

    const result = await adapter.runStep(context);

    expect(result.blocked).toBeFalsy();
    expect(result.decisionRequests).toBeUndefined();
  });
});
