import { describe, expect, it } from 'vitest';
import { SequentialIdGenerator, type Agent, type Clock, type Company, type Message } from '../../core/src';
import { FakeManagerAdapter, type AgentAdapter } from '../../runtime/src';
import { MemoryStorage } from '../../storage/src';
import { Supervisor } from './supervisor';

const clock: Clock = {
  now: () => '2026-04-25T00:00:00.000Z',
};

const company: Company = {
  id: 'company-1',
  name: 'novel',
  goal: 'Publish a novel',
  status: 'active',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

const manager: Agent = {
  id: 'agent-manager',
  companyId: 'company-1',
  name: 'manager',
  role: 'manager',
  lifecycle: 'on_demand',
  capabilities: ['chat', 'plan', 'report', 'memory.write'],
  sandboxProfile: 'podman-default',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

describe('Supervisor', () => {
  it('turns a CEO steer message into a completed run with events, task, artifact, and memory', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(manager);
    const supervisor = new Supervisor({
      storage,
      adapter: new FakeManagerAdapter(),
      clock,
      ids: new SequentialIdGenerator(),
      leaseOwner: 'test-worker',
    });
    const message: Message = {
      id: 'message-1',
      companyId: company.id,
      agentId: manager.id,
      author: 'ceo',
      kind: 'steer',
      content: '请拆解小说出版项目',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, manager);
    await supervisor.tick(company.id);

    const runs = await storage.listRuns(company.id);
    const events = await storage.listEvents(company.id);
    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);
    const memoryEntries = await storage.listMemoryEntries(company.id);

    expect(runs[0]).toMatchObject({ status: 'completed', priority: 100 });
    expect(events.map((event) => event.type)).toEqual(expect.arrayContaining([
      'message_created',
      'run_queued',
      'run_leased',
      'run_started',
      'agent_event_emitted',
      'task_created',
      'artifact_created',
      'memory_updated',
      'run_completed',
    ]));
    expect(tasks[0].objective).toContain('小说出版');
    expect(artifacts[0].path).toContain('project-plan.md');
    expect(memoryEntries[0].kind).toBe('goal');
  });

  it('blocks a run and records a decision request when the manager needs CEO input', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(manager);
    const supervisor = new Supervisor({
      storage,
      adapter: new FakeManagerAdapter(),
      clock,
      ids: new SequentialIdGenerator(),
      leaseOwner: 'test-worker',
    });
    const message: Message = {
      id: 'message-1',
      companyId: company.id,
      agentId: manager.id,
      author: 'ceo',
      kind: 'steer',
      content: '需要确认小说方向',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, manager);
    await supervisor.tick(company.id);

    const runs = await storage.listRuns(company.id);
    const decisions = await storage.listDecisionRequests(company.id);
    const events = await storage.listEvents(company.id);

    expect(runs[0].status).toBe('blocked');
    expect(decisions[0].title).toBe('Confirm project direction');
    expect(events.map((event) => event.type)).toContain('decision_required');
  });

  it('creates missing worker agents and queues delegated task runs from a manager result', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(manager);
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          delegations: [
            {
              agentName: 'researcher',
              role: 'worker',
              objective: `Research historical context for ${context.messages.at(-1)?.content}`,
              expectedOutput: 'A concise research brief with usable period details.',
              capabilities: ['research', 'report'],
            },
          ],
        };
      },
    };
    const supervisor = new Supervisor({
      storage,
      adapter,
      clock,
      ids: new SequentialIdGenerator(),
      leaseOwner: 'test-worker',
    });
    const message: Message = {
      id: 'message-1',
      companyId: company.id,
      agentId: manager.id,
      author: 'ceo',
      kind: 'steer',
      content: '创作一部历史小说',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, manager);
    await supervisor.tick(company.id);

    const agents = await storage.listAgents(company.id);
    const tasks = await storage.listTasks(company.id);
    const runs = await storage.listRuns(company.id);
    const messages = await storage.listMessages(company.id);

    const researcher = agents.find((agent) => agent.name === 'researcher');
    expect(researcher).toMatchObject({
      role: 'worker',
      capabilities: ['research', 'report'],
    });
    expect(tasks[0]).toMatchObject({
      assignedAgentId: researcher?.id,
      title: 'Delegated task for researcher',
      status: 'queued',
    });
    expect(messages.at(-1)).toMatchObject({
      agentId: researcher?.id,
      author: 'system',
      kind: 'follow_up',
      content: expect.stringContaining('Research historical context'),
    });
    expect(runs.at(-1)).toMatchObject({
      agentId: researcher?.id,
      kind: 'continuation',
      status: 'queued',
      priority: 50,
    });
  });
});
