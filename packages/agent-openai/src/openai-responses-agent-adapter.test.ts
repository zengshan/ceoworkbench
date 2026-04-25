import { describe, expect, it } from 'vitest';
import type { AgentContext } from '../../runtime/src';
import { OpenAIResponsesAgentAdapter } from './openai-responses-agent-adapter';

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

describe('OpenAIResponsesAgentAdapter', () => {
  it('calls the Responses API and parses output_text as an agent step result', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetchFn = async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          events: [],
          tasks: [
            {
              id: 'task-1',
              companyId: 'company-1',
              title: 'Plan novel',
              objective: '拆解小说出版项目',
              expectedOutput: 'Plan',
              status: 'submitted',
              priority: 100,
              dependencyTaskIds: [],
              inputArtifactIds: [],
              outputArtifactIds: [],
              requiresReview: true,
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
            },
          ],
        }),
      }), { status: 200 });
    };
    const adapter = new OpenAIResponsesAgentAdapter({
      apiKey: 'test-key',
      model: 'gpt-5.2',
      fetchFn,
    });

    const result = await adapter.runStep(context);
    const body = JSON.parse(String(requests[0].init.body));

    expect(requests[0].url).toBe('https://api.openai.com/v1/responses');
    expect(requests[0].init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Content-Type': 'application/json',
    });
    expect(body.model).toBe('gpt-5.2');
    expect(body.instructions).toContain('CEO Workbench');
    expect(body.input).toContain('请拆解小说出版项目');
    expect(result.tasks?.[0].objective).toBe('拆解小说出版项目');
  });

  it('fails clearly when the Responses API returns an error status', async () => {
    const adapter = new OpenAIResponsesAgentAdapter({
      apiKey: 'test-key',
      model: 'gpt-5.2',
      fetchFn: async () => new Response(JSON.stringify({ error: { message: 'bad key' } }), { status: 401 }),
    });

    await expect(adapter.runStep(context)).rejects.toThrow('OpenAI Responses API failed with 401: bad key');
  });
});
