import { describe, expect, it } from 'vitest';
import type { Agent, Artifact, Company, RunEvent } from '../../core/src';
import { MemoryStorage } from '../../storage/src';
import { renderMarkdownReport } from './render-markdown';
import { renderTerminalReport } from './render-terminal';
import { buildArtifactReport, buildBriefingReport, buildDecisionReport, buildStatusReport, buildTimelineReport } from './report-builder';

const company: Company = {
  id: 'company-1',
  name: 'novel',
  goal: 'Publish a novel',
  status: 'active',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

const agent: Agent = {
  id: 'agent-manager',
  companyId: company.id,
  name: 'manager',
  role: 'manager',
  lifecycle: 'on_demand',
  capabilities: ['chat'],
  sandboxProfile: 'podman-default',
  createdAt: '2026-04-25T00:00:00.000Z',
  updatedAt: '2026-04-25T00:00:00.000Z',
};

describe('reporter', () => {
  it('builds and renders a compact status report', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);

    const report = await buildStatusReport(storage, company.id);
    const output = renderTerminalReport(report);

    expect(output).toContain('Company status: novel');
    expect(output).toContain('Artifacts: 0');
  });

  it('shows agents with current state and latest activity in the status report', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(agent);
    await storage.enqueueRun({
      id: 'run-1',
      companyId: company.id,
      agentId: agent.id,
      kind: 'ceo_steer',
      status: 'running',
      priority: 100,
      attempt: 0,
      maxAttempts: 3,
      queuedAt: '2026-04-25T00:00:00.000Z',
    });
    const event: RunEvent = {
      id: 'event-1',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      type: 'agent_event_emitted',
      payload: { text: 'Manager created the first planning task.' },
      createdAt: '2026-04-25T00:01:00.000Z',
    };
    await storage.appendRunEvent(event);
    await storage.appendRunEvent({
      id: 'event-2',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      type: 'run_completed',
      payload: { runId: 'run-1' },
      createdAt: '2026-04-25T00:02:00.000Z',
    });

    const report = await buildStatusReport(storage, company.id);
    const output = renderTerminalReport(report);

    expect(output).toContain('Team members');
    expect(output).toContain('manager');
    expect(output).toContain('manager');
    expect(output).toContain('on_demand');
    expect(output).toContain('running');
    expect(output).toContain('Manager created the first planning task.');
  });

  it('groups artifacts by producing agent', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(agent);
    const artifact: Artifact = {
      id: 'artifact-1',
      companyId: company.id,
      agentId: agent.id,
      path: 'artifacts/report.md',
      title: 'Report',
      artifactType: 'markdown',
      status: 'submitted',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    };
    await storage.createArtifact(artifact);

    const report = await buildArtifactReport(storage, company.id);
    const markdown = renderMarkdownReport(report);

    expect(report.tables[0].rows).toEqual([['manager', 'artifacts/report.md']]);
    expect(markdown).toContain('| manager | artifacts/report.md |');
  });

  it('renders pending CEO decisions as actionable report content', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createDecisionRequest({
      id: 'decision-1',
      companyId: company.id,
      title: 'Choose sample direction',
      context: 'The manager found two viable novel directions.',
      options: [
        { id: 'A', label: 'Hard sci-fi puzzle', tradeoff: 'Sharper concept, higher reading barrier' },
        { id: 'B', label: 'Character suspense', tradeoff: 'More commercial, less hard sci-fi density' },
      ],
      recommendedOptionId: 'B',
      impact: 'The outline and first three chapters will follow the selected direction.',
      createdAt: '2026-04-25T00:00:00.000Z',
    });

    const report = await buildDecisionReport(storage, company.id);
    const output = renderTerminalReport(report);

    expect(report.attention).toBe('requires_decision');
    expect(output).toContain('Choose sample direction');
    expect(output).toContain('B: Character suspense');
  });

  it('renders a CEO briefing with summary, team, artifacts, breakthroughs, and next actions', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(agent);
    await storage.enqueueRun({
      id: 'run-1',
      companyId: company.id,
      agentId: agent.id,
      kind: 'ceo_steer',
      status: 'completed',
      priority: 100,
      attempt: 0,
      maxAttempts: 3,
      queuedAt: '2026-04-25T00:00:00.000Z',
      finishedAt: '2026-04-25T00:03:00.000Z',
    });
    await storage.createArtifact({
      id: 'artifact-1',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      path: 'artifacts/run-1/project-plan.md',
      title: 'Project plan draft',
      artifactType: 'markdown',
      status: 'submitted',
      createdAt: '2026-04-25T00:03:00.000Z',
      updatedAt: '2026-04-25T00:03:00.000Z',
    });
    await storage.appendRunEvent({
      id: 'event-1',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      type: 'agent_event_emitted',
      payload: { text: 'Manager created the first planning task and artifact.' },
      createdAt: '2026-04-25T00:02:00.000Z',
    });

    const report = await buildBriefingReport(storage, company.id);
    const output = renderTerminalReport(report);

    expect(output).toContain('● CEO 简报：novel');
    expect(output).toContain('关键数据');
    expect(output).toContain('团队状态');
    expect(output).toContain('Agent 产出文件');
    expect(output).toContain('关键突破');
    expect(output).toContain('下一步');
    expect(output).toContain('manager');
    expect(output).toContain('project-plan.md');
    expect(output).toContain('Manager created the first planning task and artifact.');
  });

  it('renders a CEO timeline that translates raw run events into readable progress', async () => {
    const storage = new MemoryStorage();
    await storage.createCompany(company);
    await storage.createAgent(agent);
    await storage.appendRunEvent({
      id: 'event-queued',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      type: 'run_queued',
      payload: {},
      createdAt: '2026-04-25T00:00:00.000Z',
    });
    await storage.appendRunEvent({
      id: 'event-task',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      type: 'task_created',
      payload: { title: 'Draft project decomposition' },
      createdAt: '2026-04-25T00:01:00.000Z',
    });
    await storage.appendRunEvent({
      id: 'event-artifact',
      companyId: company.id,
      runId: 'run-1',
      agentId: agent.id,
      type: 'artifact_created',
      payload: { path: 'artifacts/run-1/project-plan.md' },
      createdAt: '2026-04-25T00:02:00.000Z',
    });

    const report = await buildTimelineReport(storage, company.id);
    const output = renderTerminalReport(report);

    expect(output).toContain('● 公司时间线：novel');
    expect(output).toContain('manager 收到工作，进入队列');
    expect(output).toContain('manager 创建任务：Draft project decomposition');
    expect(output).toContain('manager 产出文件：artifacts/run-1/project-plan.md');
  });
});
