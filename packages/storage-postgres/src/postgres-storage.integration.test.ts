import { describe, expect, it } from 'vitest';
import { RandomIdGenerator, type Agent, type Clock, type Company, type Message } from '../../core/src';
import { FakeManagerAdapter } from '../../runtime/src';
import { Supervisor } from '../../supervisor/src';
import { PostgresStorage } from './postgres-storage';

const connectionString = process.env.CEOWORKBENCH_TEST_DATABASE_URL;
const describeIfDatabase = connectionString ? describe : describe.skip;

const clock: Clock = {
  now: () => new Date('2026-04-25T00:00:00.000Z').toISOString(),
};

describeIfDatabase('PostgresStorage integration', () => {
  it('persists the supervisor loop through Postgres', async () => {
    const storage = new PostgresStorage({ connectionString: connectionString! });
    const ids = new RandomIdGenerator();
    const companyId = ids.next('company');
    const agentId = ids.next('agent');

    await storage.migrate();

    const company: Company = {
      id: companyId,
      name: 'integration-novel',
      goal: 'Publish a novel',
      status: 'active',
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };
    const agent: Agent = {
      id: agentId,
      companyId,
      name: 'manager',
      role: 'manager',
      lifecycle: 'on_demand',
      capabilities: ['chat', 'plan', 'report', 'memory.write'],
      sandboxProfile: 'podman-default',
      createdAt: clock.now(),
      updatedAt: clock.now(),
    };
    const message: Message = {
      id: ids.next('message'),
      companyId,
      agentId,
      author: 'ceo',
      kind: 'steer',
      content: '请拆解小说出版项目',
      createdAt: clock.now(),
    };

    await storage.createCompany(company);
    await storage.createAgent(agent);

    const supervisor = new Supervisor({
      storage,
      adapter: new FakeManagerAdapter(),
      clock,
      ids,
      leaseOwner: 'integration-worker',
    });

    await supervisor.handleMessage(message, agent);
    await supervisor.tick(companyId);

    const [runs, events, tasks, artifacts, memoryEntries] = await Promise.all([
      storage.listRuns(companyId),
      storage.listEvents(companyId),
      storage.listTasks(companyId),
      storage.listArtifacts(companyId),
      storage.listMemoryEntries(companyId),
    ]);

    expect(runs[0].status).toBe('completed');
    expect(events.map((event) => event.type)).toContain('run_completed');
    expect(tasks[0].objective).toContain('小说出版');
    expect(artifacts[0].path).toContain('project-plan.md');
    expect(memoryEntries[0].kind).toBe('goal');

    await storage.close();
  });
});
