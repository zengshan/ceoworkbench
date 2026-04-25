import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FakeManagerAdapter } from '../../runtime/src';
import type { AgentContext } from '../../runtime/src';
import { runJsonAgentStep } from './json-runner';

describe('runJsonAgentStep', () => {
  it('reads an agent context file and writes the agent result file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-runner-'));
    const contextPath = path.join(dir, 'context.json');
    const resultPath = path.join(dir, 'result.json');
    const context: AgentContext = {
      run: {
        id: 'run-1',
        companyId: 'company-1',
        agentId: 'agent-1',
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
          agentId: 'agent-1',
          author: 'ceo',
          kind: 'steer',
          content: '请拆解小说出版项目',
          createdAt: '2026-04-25T00:00:00.000Z',
        },
      ],
      recentEvents: [],
      activeTasks: [],
      artifacts: [],
      memoryEntries: [],
    };
    await writeFile(contextPath, JSON.stringify(context), 'utf8');

    await runJsonAgentStep({
      contextPath,
      resultPath,
      adapter: new FakeManagerAdapter(),
    });

    const result = JSON.parse(await readFile(resultPath, 'utf8'));
    expect(result.events[0].type).toBe('agent_event_emitted');
    expect(result.tasks[0].objective).toContain('小说出版');
    expect(result.memoryEntries[0].content).toBe('请拆解小说出版项目');
  });
});
