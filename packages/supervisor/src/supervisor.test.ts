import { describe, expect, it } from 'vitest';
import { SequentialIdGenerator, type Agent, type Clock, type Company, type Message, type Task } from '../../core/src';
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

const worker: Agent = {
  id: 'agent-worker',
  companyId: 'company-1',
  name: 'worker',
  role: 'worker',
  lifecycle: 'on_demand',
  capabilities: ['write', 'report'],
  sandboxProfile: 'podman-default',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

const reviewer: Agent = {
  id: 'agent-reviewer',
  companyId: 'company-1',
  name: 'research-reviewer',
  role: 'reviewer',
  lifecycle: 'on_demand',
  capabilities: ['review', 'review:research_report'],
  sandboxProfile: 'podman-default',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

class StrictTaskStorage extends MemoryStorage {
  async createTask(task: Task) {
    if ((await this.listTasks(task.companyId)).some((candidate) => candidate.id === task.id)) {
      throw new Error(`duplicate task id: ${task.id}`);
    }

    return super.createTask(task);
  }
}

async function createInReviewFixture(storage: MemoryStorage) {
  await storage.createCompany(company);
  await storage.createAgent(worker);
  await storage.createAgent(reviewer);
  await storage.createTask({
    id: 'task-in-review',
    companyId: company.id,
    assignedAgentId: worker.id,
    title: 'Research brief',
    objective: 'Produce a research brief for review.',
    expectedOutput: 'A reviewed research report.',
    status: 'in_review',
    priority: 50,
    dependencyTaskIds: [],
    inputArtifactIds: [],
    outputArtifactIds: ['artifact-in-review'],
    requiresReview: true,
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
  });
  await storage.createArtifact({
    id: 'artifact-in-review',
    companyId: company.id,
    runId: 'run-worker',
    agentId: worker.id,
    taskId: 'task-in-review',
    path: 'artifacts/research.md',
    title: 'Research report',
    artifactType: 'markdown',
    kind: 'research_report',
    status: 'submitted',
    content: 'Research report body.',
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
  });
}

async function createRevisionFixture(storage: MemoryStorage) {
  await storage.createCompany(company);
  await storage.createAgent(worker);
  await storage.createAgent(reviewer);
  await storage.createTask({
    id: 'task-revision',
    companyId: company.id,
    assignedAgentId: worker.id,
    title: 'Research brief',
    objective: 'Revise a research brief after review.',
    expectedOutput: 'A revised research report with self-report.',
    status: 'running',
    priority: 50,
    dependencyTaskIds: [],
    inputArtifactIds: ['artifact-original'],
    outputArtifactIds: ['artifact-original'],
    requiresReview: true,
    pendingReviewFindings: [
      {
        id: 'F101',
        severity: 'major',
        location: 'artifacts/research.md',
        description: 'Add source coverage.',
        mustAddress: true,
      },
      {
        id: 'F102',
        severity: 'major',
        location: 'artifacts/research.md',
        description: 'Explain methodology limits.',
        mustAddress: true,
      },
    ],
    createdAt: '2026-04-25T00:00:00.000Z',
    updatedAt: '2026-04-25T00:00:00.000Z',
  });
}

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

  it('queues a structured-output retry when an agent returns only narrative fallback output', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(manager);
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-narrative',
              companyId: company.id,
              runId: context.run.id,
              agentId: manager.id,
              path: `artifacts/${context.run.id}/agent-output.md`,
              title: 'Agent output',
              artifactType: 'markdown',
              status: 'submitted',
              content: '我会开始推进，但这里没有结构化任务。',
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
            },
          ],
          structuredOutputFallback: true,
          blocked: false,
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
      content: '开始推进工作',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, manager);
    await supervisor.tick(company.id);

    const runs = await storage.listRuns(company.id);
    const messages = await storage.listMessages(company.id);
    const events = await storage.listEvents(company.id);

    expect(runs).toHaveLength(2);
    expect(runs[0]).toMatchObject({ status: 'completed' });
    expect(runs[1]).toMatchObject({
      agentId: manager.id,
      kind: 'continuation',
      status: 'queued',
    });
    expect(messages.at(-1)).toMatchObject({
      agentId: manager.id,
      author: 'system',
      kind: 'follow_up',
      content: expect.stringContaining('STRUCTURED_OUTPUT_RETRY'),
    });
    expect(events.some((event) => (
      event.type === 'agent_event_emitted'
      && event.payload.eventKind === 'structured_output_retry_queued'
    ))).toBe(true);
  });

  it('queues an independent reviewer run when a worker submits an artifact that requires review', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(worker);
    await storage.createAgent(reviewer);
    const task: Task = {
      id: 'task-reviewable',
      companyId: company.id,
      assignedAgentId: worker.id,
      title: 'Research brief',
      objective: 'Produce a research brief for review.',
      expectedOutput: 'A reviewed research report.',
      status: 'running',
      priority: 50,
      dependencyTaskIds: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      requiresReview: true,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    };
    await storage.createTask(task);
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-reviewable',
              companyId: company.id,
              runId: context.run.id,
              agentId: worker.id,
              taskId: task.id,
              path: 'artifacts/research.md',
              title: 'Research report',
              artifactType: 'markdown',
              kind: 'research_report',
              status: 'submitted',
              content: 'Research report body.',
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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
      id: 'message-worker',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Submit the research report.',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, worker);
    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const messages = await storage.listMessages(company.id);
    const runs = await storage.listRuns(company.id);

    expect(tasks.find((candidate) => candidate.id === task.id)).toMatchObject({
      status: 'in_review',
      outputArtifactIds: ['artifact-reviewable'],
    });
    expect(messages.at(-1)).toMatchObject({
      agentId: reviewer.id,
      author: 'system',
      kind: 'follow_up',
      content: expect.stringContaining('Review artifact artifact-reviewable for task task-reviewable.'),
    });
    expect(runs.at(-1)).toMatchObject({
      agentId: reviewer.id,
      kind: 'continuation',
      status: 'queued',
    });
  });

  it('creates a default reviewer and queues review when a worker artifact has no explicit task id', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(worker);
    await storage.createTask({
      id: 'task-worker-output',
      companyId: company.id,
      assignedAgentId: worker.id,
      title: 'Story architecture',
      objective: 'Produce story architecture.',
      expectedOutput: 'A reviewable story architecture artifact.',
      status: 'running',
      priority: 50,
      dependencyTaskIds: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      requiresReview: true,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-worker-output',
              companyId: company.id,
              runId: context.run.id,
              agentId: worker.id,
              path: 'artifacts/story.md',
              title: 'Story architecture',
              artifactType: 'markdown',
              status: 'submitted',
              content: 'Story architecture body.',
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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
      id: 'message-worker',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Submit story architecture.',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, worker);
    await supervisor.tick(company.id);

    const agents = await storage.listAgents(company.id);
    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);
    const messages = await storage.listMessages(company.id);
    const runs = await storage.listRuns(company.id);

    const reviewerAgent = agents.find((agent) => agent.role === 'reviewer');
    expect(reviewerAgent).toMatchObject({
      name: 'markdown-reviewer',
      capabilities: ['review:markdown'],
    });
    expect(artifacts[0]).toMatchObject({
      id: 'artifact-worker-output',
      taskId: 'task-worker-output',
    });
    expect(tasks[0]).toMatchObject({
      id: 'task-worker-output',
      status: 'in_review',
      outputArtifactIds: ['artifact-worker-output'],
    });
    expect(messages.at(-1)).toMatchObject({
      agentId: reviewerAgent?.id,
      author: 'system',
      kind: 'follow_up',
      content: expect.stringContaining('Review artifact artifact-worker-output for task task-worker-output.'),
    });
    expect(runs.at(-1)).toMatchObject({
      agentId: reviewerAgent?.id,
      kind: 'continuation',
      status: 'queued',
    });
  });

  it('reattaches a worker artifact to the current worker task when the model returns another task id', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(worker);
    await storage.createTask({
      id: 'task-worker-output',
      companyId: company.id,
      assignedAgentId: worker.id,
      title: 'Story architecture',
      objective: 'Produce story architecture.',
      expectedOutput: 'A reviewable story architecture artifact.',
      status: 'running',
      priority: 50,
      dependencyTaskIds: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      requiresReview: true,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    await storage.createTask({
      id: 'task-reviewer-output',
      companyId: company.id,
      assignedAgentId: reviewer.id,
      title: 'Review story architecture',
      objective: 'Review story architecture.',
      expectedOutput: 'A review report.',
      status: 'running',
      priority: 50,
      dependencyTaskIds: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      requiresReview: false,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-worker-output',
              companyId: company.id,
              runId: context.run.id,
              agentId: worker.id,
              taskId: 'task-reviewer-output',
              path: 'artifacts/story.md',
              title: 'Story architecture',
              artifactType: 'markdown',
              status: 'submitted',
              content: 'Story architecture body.',
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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
      id: 'message-worker',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Submit story architecture.',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, worker);
    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);

    expect(artifacts[0]).toMatchObject({
      id: 'artifact-worker-output',
      taskId: 'task-worker-output',
    });
    expect(tasks.find((task) => task.id === 'task-worker-output')).toMatchObject({
      status: 'in_review',
      outputArtifactIds: ['artifact-worker-output'],
    });
    expect(tasks.find((task) => task.id === 'task-reviewer-output')).toMatchObject({
      status: 'running',
      outputArtifactIds: [],
    });
  });

  it('updates an existing delegated task when a worker returns the same task id', async () => {
    const storage = new StrictTaskStorage();
    await storage.createCompany(company);
    await storage.createAgent(worker);
    await storage.createTask({
      id: 'task-worker',
      companyId: company.id,
      assignedAgentId: worker.id,
      title: 'Research brief',
      objective: 'Produce a research brief.',
      expectedOutput: 'A submitted brief.',
      status: 'queued',
      priority: 50,
      dependencyTaskIds: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      requiresReview: true,
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
    const adapter: AgentAdapter = {
      async runStep() {
        return {
          events: [],
          tasks: [
            {
              id: 'task-worker',
              companyId: company.id,
              assignedAgentId: worker.id,
              title: 'Research brief',
              objective: 'Produce a research brief.',
              expectedOutput: 'A submitted brief.',
              status: 'submitted',
              priority: 50,
              dependencyTaskIds: [],
              inputArtifactIds: [],
              outputArtifactIds: ['artifact-worker'],
              requiresReview: true,
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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
      id: 'message-worker',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Submit the research report.',
      createdAt: '2026-04-25T00:00:00.000Z',
    };

    await supervisor.handleMessage(message, worker);
    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const runs = await storage.listRuns(company.id);

    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: 'task-worker',
      status: 'submitted',
      outputArtifactIds: ['artifact-worker'],
    });
    expect(runs[0]).toMatchObject({ status: 'completed' });
  });

  it('completes the original task when a reviewer accepts the artifact with high confidence', async () => {
    const storage = new MemoryStorage();
    await createInReviewFixture(storage);
    const adapter: AgentAdapter = {
      async runStep() {
        return {
          events: [],
          reviewReports: [
            {
              artifactId: 'artifact-in-review',
              taskId: 'task-in-review',
              verdict: 'accepted',
              confidence: 0.92,
              findings: [],
              acceptanceCriteriaCheck: [
                {
                  criterion: 'Research report is usable.',
                  met: true,
                  evidence: 'The artifact answers the requested brief.',
                },
              ],
              scopeDriftDetected: false,
              needsCeoInput: false,
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
    await supervisor.handleMessage({
      id: 'message-reviewer',
      companyId: company.id,
      agentId: reviewer.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Review artifact artifact-in-review for task task-in-review.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, reviewer);

    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);
    const events = await storage.listEvents(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-in-review')).toMatchObject({
      status: 'completed',
    });
    expect(artifacts.find((candidate) => candidate.id === 'artifact-in-review')).toMatchObject({
      status: 'accepted',
    });
    expect(events.map((event) => event.type)).toContain('report_created');
  });

  it('returns the task to the worker when review requests revision with confidence', async () => {
    const storage = new MemoryStorage();
    await createInReviewFixture(storage);
    const adapter: AgentAdapter = {
      async runStep() {
        return {
          events: [],
          reviewReports: [
            {
              artifactId: 'artifact-in-review',
              taskId: 'task-in-review',
              verdict: 'needs_revision',
              confidence: 0.74,
              findings: [
                {
                  id: 'F101',
                  severity: 'major',
                  location: 'artifacts/research.md',
                  description: 'Add source coverage.',
                  suggestedFix: 'Include two primary sources.',
                  mustAddress: true,
                },
              ],
              acceptanceCriteriaCheck: [],
              scopeDriftDetected: false,
              needsCeoInput: false,
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
    await supervisor.handleMessage({
      id: 'message-reviewer',
      companyId: company.id,
      agentId: reviewer.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Review artifact artifact-in-review for task task-in-review.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, reviewer);

    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);
    const messages = await storage.listMessages(company.id);
    const runs = await storage.listRuns(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-in-review')).toMatchObject({
      status: 'running',
    });
    expect(artifacts.find((candidate) => candidate.id === 'artifact-in-review')).toMatchObject({
      status: 'rejected',
    });
    expect(messages.at(-1)).toMatchObject({
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: expect.stringContaining('Revision required for artifact artifact-in-review.'),
    });
    expect(messages.at(-1)?.content).toContain('F101');
    expect(runs.at(-1)).toMatchObject({
      agentId: worker.id,
      kind: 'continuation',
      status: 'queued',
    });
  });

  it('blocks the task when review rejects the artifact with high confidence', async () => {
    const storage = new MemoryStorage();
    await createInReviewFixture(storage);
    const adapter: AgentAdapter = {
      async runStep() {
        return {
          events: [],
          reviewReports: [
            {
              artifactId: 'artifact-in-review',
              taskId: 'task-in-review',
              verdict: 'rejected',
              confidence: 0.88,
              findings: [],
              acceptanceCriteriaCheck: [],
              scopeDriftDetected: false,
              needsCeoInput: false,
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
    await supervisor.handleMessage({
      id: 'message-reviewer',
      companyId: company.id,
      agentId: reviewer.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Review artifact artifact-in-review for task task-in-review.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, reviewer);

    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-in-review')).toMatchObject({
      status: 'blocked',
    });
    expect(artifacts.find((candidate) => candidate.id === 'artifact-in-review')).toMatchObject({
      status: 'rejected',
    });
  });

  it('emits a second-opinion event instead of completing low-confidence accepted reviews', async () => {
    const storage = new MemoryStorage();
    await createInReviewFixture(storage);
    const adapter: AgentAdapter = {
      async runStep() {
        return {
          events: [],
          reviewReports: [
            {
              artifactId: 'artifact-in-review',
              taskId: 'task-in-review',
              verdict: 'accepted',
              confidence: 0.65,
              findings: [],
              acceptanceCriteriaCheck: [],
              scopeDriftDetected: false,
              needsCeoInput: false,
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
    await supervisor.handleMessage({
      id: 'message-reviewer',
      companyId: company.id,
      agentId: reviewer.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Review artifact artifact-in-review for task task-in-review.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, reviewer);

    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);
    const events = await storage.listEvents(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-in-review')).toMatchObject({
      status: 'in_review',
    });
    expect(artifacts.find((candidate) => candidate.id === 'artifact-in-review')).toMatchObject({
      status: 'submitted',
    });
    expect(events.some((event) => event.payload.eventKind === 'second_opinion_required')).toBe(true);
  });

  it('escalates the task when review explicitly asks for CEO input', async () => {
    const storage = new MemoryStorage();
    await createInReviewFixture(storage);
    const adapter: AgentAdapter = {
      async runStep() {
        return {
          events: [],
          reviewReports: [
            {
              artifactId: 'artifact-in-review',
              taskId: 'task-in-review',
              verdict: 'escalate',
              confidence: 0.91,
              findings: [],
              acceptanceCriteriaCheck: [],
              scopeDriftDetected: false,
              needsCeoInput: true,
              ceoQuestion: 'Choose whether to expand scope.',
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
    await supervisor.handleMessage({
      id: 'message-reviewer',
      companyId: company.id,
      agentId: reviewer.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Review artifact artifact-in-review for task task-in-review.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, reviewer);

    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const events = await storage.listEvents(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-in-review')).toMatchObject({
      status: 'escalated',
    });
    expect(events.some((event) => event.payload.eventKind === 'review_escalated')).toBe(true);
  });

  it('allows a revision artifact with a complete self-report to enter normal review', async () => {
    const storage = new MemoryStorage();
    await createRevisionFixture(storage);
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-revision',
              companyId: company.id,
              runId: context.run.id,
              agentId: worker.id,
              taskId: 'task-revision',
              path: 'artifacts/research-revision.md',
              title: 'Research report revision',
              artifactType: 'markdown',
              kind: 'research_report',
              status: 'submitted',
              content: 'Revised body.',
              revisionSelfReport: {
                findingResponses: [
                  { findingId: 'F101', status: 'addressed', note: 'Added primary source coverage.' },
                  { findingId: 'F102', status: 'not_addressed', note: 'Methodology section is blocked by missing source access.' },
                ],
              },
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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

    await supervisor.handleMessage({
      id: 'message-worker-revision',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Revise the artifact.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, worker);
    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const messages = await storage.listMessages(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-revision')).toMatchObject({
      status: 'in_review',
      outputArtifactIds: ['artifact-original', 'artifact-revision'],
    });
    expect(messages.at(-1)).toMatchObject({
      agentId: reviewer.id,
      content: expect.stringContaining('Review artifact artifact-revision for task task-revision.'),
    });
  });

  it('escalates a revision artifact that silently skips a must-address finding', async () => {
    const storage = new MemoryStorage();
    await createRevisionFixture(storage);
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-revision',
              companyId: company.id,
              runId: context.run.id,
              agentId: worker.id,
              taskId: 'task-revision',
              path: 'artifacts/research-revision.md',
              title: 'Research report revision',
              artifactType: 'markdown',
              kind: 'research_report',
              status: 'submitted',
              content: 'Revised body.',
              revisionSelfReport: {
                findingResponses: [
                  { findingId: 'F102', status: 'addressed', note: 'Explained methodology limits.' },
                ],
              },
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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

    await supervisor.handleMessage({
      id: 'message-worker-revision',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Revise the artifact.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, worker);
    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const artifacts = await storage.listArtifacts(company.id);
    const events = await storage.listEvents(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-revision')).toMatchObject({ status: 'escalated' });
    expect(artifacts.find((candidate) => candidate.id === 'artifact-revision')).toMatchObject({ status: 'rejected' });
    expect(events.some((event) => event.payload.eventKind === 'silent_must_address_skip')).toBe(true);
  });

  it('escalates a revision artifact that marks not-addressed without justification', async () => {
    const storage = new MemoryStorage();
    await createRevisionFixture(storage);
    const adapter: AgentAdapter = {
      async runStep(context) {
        return {
          events: [],
          artifacts: [
            {
              id: 'artifact-revision',
              companyId: company.id,
              runId: context.run.id,
              agentId: worker.id,
              taskId: 'task-revision',
              path: 'artifacts/research-revision.md',
              title: 'Research report revision',
              artifactType: 'markdown',
              kind: 'research_report',
              status: 'submitted',
              content: 'Revised body.',
              revisionSelfReport: {
                findingResponses: [
                  { findingId: 'F101', status: 'addressed', note: 'Added source coverage.' },
                  { findingId: 'F102', status: 'not_addressed', note: ' ' },
                ],
              },
              createdAt: '2026-04-25T00:00:00.000Z',
              updatedAt: '2026-04-25T00:00:00.000Z',
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

    await supervisor.handleMessage({
      id: 'message-worker-revision',
      companyId: company.id,
      agentId: worker.id,
      author: 'system',
      kind: 'follow_up',
      content: 'Revise the artifact.',
      createdAt: '2026-04-25T00:00:00.000Z',
    }, worker);
    await supervisor.tick(company.id);

    const tasks = await storage.listTasks(company.id);
    const events = await storage.listEvents(company.id);

    expect(tasks.find((candidate) => candidate.id === 'task-revision')).toMatchObject({ status: 'escalated' });
    expect(events.some((event) => event.payload.eventKind === 'unjustified_skip')).toBe(true);
  });
});
