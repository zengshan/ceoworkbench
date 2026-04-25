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
});
