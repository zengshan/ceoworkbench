import { describe, expect, it } from 'vitest';
import type { Agent, Artifact, Company } from '../../core/src';
import { MemoryStorage } from '../../storage/src';
import { renderMarkdownReport } from './render-markdown';
import { renderTerminalReport } from './render-terminal';
import { buildArtifactReport, buildStatusReport } from './report-builder';

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
});
