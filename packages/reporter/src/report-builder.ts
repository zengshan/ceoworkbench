import type { Artifact, Company, EntityId, ReportDocument, ReportMetric, RunEvent } from '../../core/src';
import type { Storage } from '../../storage/src';

export async function buildStatusReport(storage: Storage, companyId: EntityId): Promise<ReportDocument> {
  const [companies, agents, runs, events, tasks, artifacts, decisionRequests] = await Promise.all([
    storage.listCompanies(),
    storage.listAgents(companyId),
    storage.listRuns(companyId),
    storage.listEvents(companyId),
    storage.listTasks(companyId),
    storage.listArtifacts(companyId),
    storage.listDecisionRequests(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const pendingDecisions = decisionRequests.filter((request) => !request.resolvedAt).length;
  const runningRuns = runs.filter((run) => run.status === 'running' || run.status === 'leasing').length;
  const queuedRuns = runs.filter((run) => run.status === 'queued' || run.status === 'retrying').length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const reportableTasks = tasks.filter((task) => (
    task.status !== 'queued'
    || Boolean(task.assignedAgentId)
    || task.outputArtifactIds.length > 0
  ));

  return {
    ...baseReport(company, 'status', `Company status: ${company.name}`, [
      metric('Goal', company.goal),
      metric('Runs', `${queuedRuns} queued, ${runningRuns} running, ${failedRuns} failed`),
      metric('Tasks', `${reportableTasks.filter((task) => task.status === 'completed').length}/${reportableTasks.length} completed`),
      metric('Artifacts', String(artifacts.length)),
      metric('Agents', String(agents.length)),
      metric('Pending CEO', String(pendingDecisions), pendingDecisions ? 'requires_decision' : 'info'),
    ]),
    tables: [
      {
        title: 'Team members',
        columns: ['Agent', 'Role', 'Lifecycle', 'State', 'Latest activity'],
        rows: agents.map((agent) => [
          agent.name,
          agent.role,
          agent.lifecycle,
          currentAgentState(agent.id, runs),
          latestAgentActivity(agent.id, events),
        ]),
      },
    ],
  };
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

export async function buildDecisionReport(storage: Storage, companyId: EntityId): Promise<ReportDocument> {
  const [companies, decisionRequests] = await Promise.all([
    storage.listCompanies(),
    storage.listDecisionRequests(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const pendingDecisionRequests = decisionRequests.filter((request) => !request.resolvedAt);
  const rows = pendingDecisionRequests.map((request) => [
    request.id,
    request.title,
    request.recommendedOptionId ?? '-',
    request.options.map((option) => `${option.id}: ${option.label}`).join('; '),
  ]);

  return {
    ...baseReport(company, 'decision_briefing', `CEO decisions: ${company.name}`, [
      metric('Pending decisions', String(pendingDecisionRequests.length), pendingDecisionRequests.length ? 'requires_decision' : 'info'),
    ]),
    attention: pendingDecisionRequests.length ? 'requires_decision' : 'info',
    sections: pendingDecisionRequests.map((request) => ({
      title: request.title,
      body: `${request.context}\nImpact: ${request.impact}`,
      items: request.options.map((option) => `${option.id}. ${option.label} - ${option.tradeoff}`),
    })),
    tables: [
      {
        title: 'Pending decisions',
        columns: ['ID', 'Title', 'Recommended', 'Options'],
        rows,
      },
    ],
  };
}

export async function buildBriefingReport(storage: Storage, companyId: EntityId): Promise<ReportDocument> {
  const [companies, agents, runs, events, tasks, artifacts, decisionRequests] = await Promise.all([
    storage.listCompanies(),
    storage.listAgents(companyId),
    storage.listRuns(companyId),
    storage.listEvents(companyId),
    storage.listTasks(companyId),
    storage.listArtifacts(companyId),
    storage.listDecisionRequests(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const completedRuns = runs.filter((run) => run.status === 'completed').length;
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  const pendingDecisions = decisionRequests.filter((request) => !request.resolvedAt).length;
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const report = baseReport(company, 'progress', `● CEO 简报：${company.name}`, [
    metric('目标', company.goal),
    metric('运行', `${completedRuns} completed, ${failedRuns} failed`),
    metric('任务', `${completedTasks}/${tasks.length} completed`),
    metric('产出文件', `${artifacts.length} 个`),
    metric('团队成员', `${agents.length} 个`),
    metric('待 CEO 决策', `${pendingDecisions} 个`, pendingDecisions ? 'requires_decision' : 'info'),
  ]);
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));

  return {
    ...report,
    sections: [
      {
        title: '关键数据',
        body: pendingDecisions
          ? `当前有 ${pendingDecisions} 个事项需要 CEO 决策。`
          : '当前没有阻塞 CEO 的决策项。',
      },
      {
        title: '关键突破',
        body: buildBreakthrough(events),
      },
      {
        title: '下一步',
        body: pendingDecisions
          ? '优先处理 CEO 决策项，然后让 manager 继续推进。'
          : '让 manager 基于当前产出继续拆解下一轮任务。',
      },
    ],
    tables: [
      {
        title: '团队状态',
        columns: ['Agent', 'Role', 'State', 'Latest activity'],
        rows: agents.map((agent) => [
          agent.name,
          agent.role,
          currentAgentState(agent.id, runs),
          latestAgentActivity(agent.id, events),
        ]),
      },
      {
        title: 'Agent 产出文件',
        columns: ['Agent', '文件'],
        rows: artifacts.map((artifact) => [
          artifact.agentId ? agentNameById.get(artifact.agentId) ?? artifact.agentId : 'system',
          artifact.path,
        ]),
      },
    ],
    linkedArtifacts: artifacts.map((artifact) => artifact.id),
    linkedRuns: runs.map((run) => run.id),
    linkedEvents: events.map((event) => event.id),
    recommendedActions: pendingDecisions
      ? ['处理待决策事项', '查看团队状态', '检查最新产出文件']
      : ['查看最新产出文件', '给 manager 下达下一轮目标'],
  };
}

export async function buildTimelineReport(storage: Storage, companyId: EntityId): Promise<ReportDocument> {
  const [companies, agents, events, artifacts] = await Promise.all([
    storage.listCompanies(),
    storage.listAgents(companyId),
    storage.listEvents(companyId),
    storage.listArtifacts(companyId),
  ]);
  const company = findCompany(companies, companyId);
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]));
  const outputItems = artifacts.slice(-10).map((artifact) => {
    const agent = artifact.agentId ? agentNameById.get(artifact.agentId) ?? artifact.agentId : 'system';
    return `${agent} 产出：${artifact.path}（${artifact.title} / ${artifact.status}）`;
  });
  const translatedEvents = events
    .filter((event) => event.runId)
    .slice(-30)
    .map((event) => translateEvent(event, agentNameById));

  return {
    ...baseReport(company, 'progress', `● 公司时间线：${company.name}`, [
      metric('事件', `${translatedEvents.length} 条`),
      metric('Agent', `${agents.length} 个`),
    ]),
    sections: [
      {
        title: '关键产出',
        body: outputItems.length ? '以下是最近可检查的交付物。' : '暂无可检查的交付物。',
        items: outputItems,
      },
      {
        title: '最近进展',
        body: translatedEvents.length ? '以下是最近工作进展。' : '暂无工作进展。',
        items: translatedEvents,
      },
    ],
    linkedEvents: events.map((event) => event.id),
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

function currentAgentState(agentId: EntityId, runs: Awaited<ReturnType<Storage['listRuns']>>) {
  const activeRun = runs.find((run) => run.agentId === agentId && ['running', 'leasing'].includes(run.status));

  if (activeRun) {
    return activeRun.status;
  }

  const queuedRun = runs.find((run) => run.agentId === agentId && ['queued', 'retrying'].includes(run.status));

  if (queuedRun) {
    return queuedRun.status;
  }

  const latestRun = [...runs].reverse().find((run) => run.agentId === agentId);
  return latestRun?.status ?? 'idle';
}

function latestAgentActivity(agentId: EntityId, events: Awaited<ReturnType<Storage['listEvents']>>) {
  const agentEvent = [...events]
    .reverse()
    .find((candidate) => candidate.agentId === agentId && candidate.type === 'agent_event_emitted');
  const event = agentEvent ?? [...events].reverse().find((candidate) => candidate.agentId === agentId);

  if (!event) {
    return 'No activity yet';
  }

  const text = event.payload.text ?? event.payload.message ?? event.payload.title;
  return typeof text === 'string' && text.length ? text : event.type;
}

function buildBreakthrough(events: RunEvent[]) {
  const agentActivity = [...events]
    .reverse()
    .find((event) => event.type === 'agent_event_emitted' && typeof event.payload.text === 'string');

  if (agentActivity && typeof agentActivity.payload.text === 'string') {
    return agentActivity.payload.text;
  }

  const completed = events.find((event) => event.type === 'run_completed');
  return completed ? '本轮工作已完成。' : '还没有形成明确突破。';
}

function translateEvent(event: RunEvent, agentNameById: Map<string, string>) {
  const agent = event.agentId ? agentNameById.get(event.agentId) ?? event.agentId : 'system';

  switch (event.type) {
    case 'run_queued':
      return `${agent} 收到工作，进入队列`;
    case 'run_leased':
      return `${agent} 的工作被 supervisor 接管执行`;
    case 'run_started':
      return `${agent} 开始工作`;
    case 'agent_event_emitted': {
      const text = event.payload.text ?? event.payload.message;
      return `${agent} 汇报：${typeof text === 'string' ? text : '更新了进展'}`;
    }
    case 'agent_created':
      return `${agent} 创建 ${event.payload.role === 'reviewer' ? 'reviewer' : 'worker'}：${event.payload.name ?? event.payload.agentId ?? '未命名成员'}`;
    case 'task_created':
      return `${agent} 创建任务：${event.payload.title ?? event.payload.taskId ?? '未命名任务'}`;
    case 'artifact_created':
      return `${agent} 产出文件：${event.payload.path ?? event.payload.artifactId ?? '未命名文件'}`;
    case 'memory_updated':
      return `${agent} 更新了公司记忆`;
    case 'report_created':
      return `${agent} 创建评审报告：${event.payload.title ?? event.payload.reportId ?? '未命名报告'}`;
    case 'decision_required':
      return `${agent} 请求 CEO 决策：${event.payload.title ?? event.payload.decisionRequestId ?? '未命名决策'}`;
    case 'run_completed':
      return `${agent} 完成本轮工作`;
    case 'run_failed':
      return `${agent} 工作失败：${event.payload.errorMessage ?? '未知错误'}`;
    default:
      return `${agent} 发生事件：${event.type}`;
  }
}
