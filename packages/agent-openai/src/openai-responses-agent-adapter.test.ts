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
    expect(body.instructions).toContain('Reviewer agents must return reviewReports');
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      name: 'agent_step_result',
      strict: true,
    });
    expect(body.text.format.schema.required).toContain('reviewReports');
    expect(body.text.format.schema.properties.reviewReports).toMatchObject({
      type: 'array',
    });
    expect(body.input).toEqual([
      {
        role: 'user',
        content: expect.stringContaining('请拆解小说出版项目'),
      },
    ]);
    expect(body.stream).toBe(true);
    expect(result.tasks?.[0].objective).toBe('拆解小说出版项目');
  });

  it('parses streaming Responses API SSE output_text deltas as an agent step result', async () => {
    const payload = JSON.stringify({
      events: [],
      tasks: [],
      delegations: [],
      artifacts: [],
      memoryEntries: [],
      decisionRequests: [],
      continuationRequested: false,
      blocked: false,
    });
    const chunks = [
      payload.slice(0, 30),
      payload.slice(30),
    ];
    const adapter = new OpenAIResponsesAgentAdapter({
      apiKey: 'test-key',
      model: 'gpt-5.4',
      fetchFn: async () => new Response([
        'data: {"type":"response.output_text.delta","delta":',
        JSON.stringify(chunks[0]),
        '}\n\n',
        'data: {"type":"response.output_text.delta","delta":',
        JSON.stringify(chunks[1]),
        '}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ].join(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    });

    const result = await adapter.runStep(context);

    expect(result).toMatchObject({
      events: [],
      blocked: false,
      continuationRequested: false,
    });
  });

  it('does not duplicate streaming output when the SSE stream includes both deltas and final text', async () => {
    const payload = JSON.stringify({
      events: [],
      tasks: [],
      delegations: [
        {
          agentName: 'Story Development Lead',
          role: 'worker',
          lifecycle: 'on_demand',
          capabilities: ['story'],
          sandboxProfile: 'default',
          title: 'Create concept',
          objective: 'Create a concept package.',
          expectedOutput: 'Concept package.',
          priority: 90,
          requiresReview: true,
        },
      ],
      artifacts: [],
      memoryEntries: [],
      decisionRequests: [],
      continuationRequested: true,
      blocked: false,
    });
    const chunks = [
      payload.slice(0, 80),
      payload.slice(80),
    ];
    const adapter = new OpenAIResponsesAgentAdapter({
      apiKey: 'test-key',
      model: 'gpt-5.4',
      fetchFn: async () => new Response([
        'data: {"type":"response.output_text.delta","delta":',
        JSON.stringify(chunks[0]),
        '}\n\n',
        'data: {"type":"response.output_text.delta","delta":',
        JSON.stringify(chunks[1]),
        '}\n\n',
        'data: {"type":"response.output_text.done","text":',
        JSON.stringify(payload),
        '}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ].join(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    });

    const result = await adapter.runStep(context);

    expect(result.delegations?.[0]).toMatchObject({
      agentName: 'Story Development Lead',
      objective: 'Create a concept package.',
    });
    expect(result.artifacts?.[0]?.path).not.toBe(`artifacts/${context.run.id}/agent-output.md`);
  });

  it('wraps non-JSON model output into a submitted artifact instead of failing', async () => {
    const adapter = new OpenAIResponsesAgentAdapter({
      apiKey: 'test-key',
      model: 'gpt-5.4',
      fetchFn: async () => new Response([
        'data: {"type":"response.output_text.delta","delta":"可以，我会拆解历史小说项目。"}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ].join(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    });

    const result = await adapter.runStep(context);

    expect(result.events[0].payload.text).toContain('returned narrative output');
    expect(result.artifacts?.[0]).toMatchObject({
      companyId: context.run.companyId,
      runId: context.run.id,
      agentId: context.run.agentId,
      path: `artifacts/${context.run.id}/agent-output.md`,
      content: '可以，我会拆解历史小说项目。',
    });
    expect(result.structuredOutputFallback).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('normalizes manager planning JSON delegations into runtime delegation requests', async () => {
    const planningJson = JSON.stringify({
      status: 'in_progress',
      summary: '已收敛为北魏尔朱荣时代的小人物历史小说。',
      blocked: null,
      delegations: [
        {
          role: 'researcher',
          goal: '提交北魏尔朱荣时代创作研究包 v1。',
          instructions: ['整理尔朱荣崛起时间线。', '标出小人物可旁观的历史节点。'],
        },
        {
          role: 'writer',
          goal: '准备第一章开篇方案。',
          instructions: ['突出人在历史中的无奈。'],
        },
      ],
      artifacts: [],
      next_steps: ['等待第一轮成果。'],
    });
    const adapter = new OpenAIResponsesAgentAdapter({
      apiKey: 'test-key',
      model: 'gpt-5.4',
      fetchFn: async () => new Response([
        'data: {"type":"response.output_text.delta","delta":',
        JSON.stringify(planningJson),
        '}\n\n',
        'data: {"type":"response.completed"}\n\n',
      ].join(''), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    });

    const result = await adapter.runStep(context);

    expect(result.events[0].payload.text).toContain('已收敛');
    expect(result.delegations).toEqual([
      expect.objectContaining({
        agentName: 'researcher',
        role: 'worker',
        objective: expect.stringContaining('提交北魏尔朱荣时代创作研究包'),
        expectedOutput: expect.stringContaining('整理尔朱荣崛起时间线'),
      }),
      expect.objectContaining({
        agentName: 'writer',
        role: 'worker',
        objective: expect.stringContaining('准备第一章开篇方案'),
      }),
    ]);
    expect(result.blocked).toBe(false);
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
