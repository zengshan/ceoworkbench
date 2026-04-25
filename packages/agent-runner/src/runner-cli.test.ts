import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentContext } from '../../runtime/src';
import { runAgentRunnerCli } from './runner-cli';

describe('runAgentRunnerCli', () => {
  it('runs the default fake manager from context path to result path', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'ceoworkbench-runner-cli-'));
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

    await expect(runAgentRunnerCli([contextPath, resultPath], {})).resolves.toBeUndefined();

    const result = JSON.parse(await readFile(resultPath, 'utf8'));
    expect(result.tasks[0].objective).toContain('小说出版');
  });

  it('rejects missing paths', async () => {
    await expect(runAgentRunnerCli([], {})).rejects.toThrow('Usage: agent-runner <context.json> <result.json>');
  });
});
