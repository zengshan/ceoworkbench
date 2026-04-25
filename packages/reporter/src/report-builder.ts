import type { Artifact, Company, EntityId, ReportDocument, ReportMetric } from '../../core/src';
import type { Storage } from '../../storage/src';

export async function buildStatusReport(storage: Storage, companyId: EntityId): Promise<ReportDocument> {
  const [companies, runs, tasks, artifacts, decisionRequests] = await Promise.all([
    storage.listCompanies(),
    storage.listRuns(companyId),
    storage.listTasks(companyId),
    storage.listArtifacts(companyId),
    storage.listDecisionRequests(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const pendingDecisions = decisionRequests.filter((request) => !request.resolvedAt).length;
  const runningRuns = runs.filter((run) => run.status === 'running' || run.status === 'leasing').length;
  const queuedRuns = runs.filter((run) => run.status === 'queued' || run.status === 'retrying').length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;

  return baseReport(company, 'status', `Company status: ${company.name}`, [
    metric('Goal', company.goal),
    metric('Runs', `${queuedRuns} queued, ${runningRuns} running, ${failedRuns} failed`),
    metric('Tasks', `${tasks.filter((task) => task.status === 'completed').length}/${tasks.length} completed`),
    metric('Artifacts', String(artifacts.length)),
    metric('Pending CEO', String(pendingDecisions), pendingDecisions ? 'requires_decision' : 'info'),
  ]);
}

export async function buildArtifactReport(storage: Storage, companyId: EntityId): Promise<ReportDocument> {
  const [companies, artifacts, agents] = await Promise.all([
    storage.listCompanies(),
    storage.listArtifacts(companyId),
    storage.listAgents(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));
  const groupedArtifacts = groupArtifactsByAgent(artifacts, agentNameById);
  const rows = [...groupedArtifacts.entries()].map(([agentName, paths]) => [agentName, paths.join(', ')]);

  return {
    ...baseReport(company, 'artifact_index', `Artifact index: ${company.name}`, [
      metric('Artifacts', String(artifacts.length)),
      metric('Agents', String(groupedArtifacts.size)),
    ]),
    tables: [
      {
        title: 'Agent artifacts',
        columns: ['Agent', 'Files'],
        rows,
      },
    ],
    linkedArtifacts: artifacts.map((artifact) => artifact.id),
  };
}

export async function buildRunSummaryReport(storage: Storage, companyId: EntityId, runId?: EntityId): Promise<ReportDocument> {
  const [companies, runs, events, tasks, artifacts] = await Promise.all([
    storage.listCompanies(),
    storage.listRuns(companyId),
    storage.listEvents(companyId),
    storage.listTasks(companyId),
    storage.listArtifacts(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const run = runId ? runs.find((candidate) => candidate.id === runId) : runs.at(-1);

  if (!run) {
    return baseReport(company, 'progress', `Run summary: ${company.name}`, [metric('Runs', '0')]);
  }

  const runEvents = events.filter((event) => event.runId === run.id);
  const runTasks = tasks.filter((task) => task.id.startsWith(run.id));
  const runArtifacts = artifacts.filter((artifact) => artifact.runId === run.id);

  return {
    ...baseReport(company, 'progress', `Run summary: ${run.id}`, [
      metric('Status', run.status),
      metric('Kind', run.kind),
      metric('Priority', String(run.priority)),
      metric('Events', String(runEvents.length)),
      metric('Artifacts', String(runArtifacts.length)),
    ]),
    sections: [
      {
        title: 'Completed work',
        body: runTasks.length ? 'The manager produced structured work items.' : 'No tasks were produced.',
        items: runTasks.map((task) => task.title),
      },
    ],
    tables: [
      {
        title: 'Run artifacts',
        columns: ['File', 'Status'],
        rows: runArtifacts.map((artifact) => [artifact.path, artifact.status]),
      },
    ],
    linkedRuns: [run.id],
    linkedEvents: runEvents.map((event) => event.id),
    linkedArtifacts: runArtifacts.map((artifact) => artifact.id),
  };
}

function baseReport(company: Company, reportType: ReportDocument['reportType'], title: string, metrics: ReportMetric[]): ReportDocument {
  const now = new Date().toISOString();

  return {
    id: `report-${reportType}-${company.id}-${now}`,
    companyId: company.id,
    title,
    reportType,
    scope: { type: 'company', id: company.id },
    attention: metrics.some((item) => item.tone === 'requires_decision') ? 'requires_decision' : 'info',
    timeRange: {
      from: company.createdAt,
      to: now,
    },
    headline: title,
    metrics,
    sections: [],
    tables: [],
    linkedTasks: [],
    linkedArtifacts: [],
    linkedRuns: [],
    linkedEvents: [],
    recommendedActions: [],
    createdAt: now,
  };
}

function metric(label: string, value: string, tone?: ReportMetric['tone']): ReportMetric {
  return { label, value, tone };
}

function findCompany(companies: Company[], companyId: EntityId) {
  const company = companies.find((candidate) => candidate.id === companyId);

  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  return company;
}

function groupArtifactsByAgent(artifacts: Artifact[], agentNameById: Map<string, string>) {
  const grouped = new Map<string, string[]>();

  for (const artifact of artifacts) {
    const agentName = artifact.agentId ? agentNameById.get(artifact.agentId) ?? artifact.agentId : 'system';
    grouped.set(agentName, [...(grouped.get(agentName) ?? []), artifact.path]);
  }

  return grouped;
}
