import { describe, expect, it } from 'vitest';
import type { Agent, Artifact, Company, RunEvent } from '../../core/src';
import { MemoryStorage } from '../../storage/src';
import { renderMarkdownReport } from './render-markdown';
import { renderTerminalReport } from './render-terminal';
import { buildArtifactReport, buildDecisionReport, buildStatusReport } from './report-builder';

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
});
