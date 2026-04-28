import { canLeaseRun, canRecoverRun, type Agent, type Artifact, type Company, type DecisionRequest, type EntityId, type MemoryEntry, type Message, type ReportDocument, type Run, type RunEvent, type Task } from '../../core/src';
import type { LeaseRunInput, Storage } from './storage';

function byCreatedAt<T extends { createdAt?: string; queuedAt?: string }>(first: T, second: T) {
  return (first.createdAt ?? first.queuedAt ?? '').localeCompare(second.createdAt ?? second.queuedAt ?? '');
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryStorage implements Storage {
  private readonly companies = new Map<EntityId, Company>();
  private readonly agents = new Map<EntityId, Agent>();
  private readonly messages = new Map<EntityId, Message>();
  private readonly runs = new Map<EntityId, Run>();
  private readonly events = new Map<EntityId, RunEvent>();
  private readonly tasks = new Map<EntityId, Task>();
  private readonly artifacts = new Map<EntityId, Artifact>();
  private readonly memoryEntries = new Map<EntityId, MemoryEntry>();
  private readonly reports = new Map<EntityId, ReportDocument>();
  private readonly decisionRequests = new Map<EntityId, DecisionRequest>();

  async createCompany(company: Company) {
    this.companies.set(company.id, clone(company));
    return clone(company);
  }

  async createAgent(agent: Agent) {
    this.agents.set(agent.id, clone(agent));
    return clone(agent);
  }

  async appendMessage(message: Message) {
    this.messages.set(message.id, clone(message));
    return clone(message);
  }

  async appendRunEvent(event: RunEvent) {
    this.events.set(event.id, clone(event));
    return clone(event);
  }

  async enqueueRun(run: Run) {
    this.runs.set(run.id, clone(run));
    return clone(run);
  }

  async leaseNextRun(input: LeaseRunInput) {
    const activeCompanyIds = new Set(
      [...this.runs.values()]
        .filter((run) => run.status === 'leasing' || run.status === 'running')
        .map((run) => run.companyId),
    );

    const candidates = [...this.runs.values()]
      .filter((run) => canLeaseRun(run.status))
      .filter((run) => (input.companyId ? run.companyId === input.companyId : true))
      .filter((run) => !activeCompanyIds.has(run.companyId))
      .sort((first, second) => {
        if (second.priority !== first.priority) {
          return second.priority - first.priority;
        }

        return first.queuedAt.localeCompare(second.queuedAt);
      });

    const nextRun = candidates[0];

    if (!nextRun) {
      return null;
    }

    const leasedRun: Run = {
      ...nextRun,
      status: 'leasing',
      leaseOwner: input.leaseOwner,
      leaseExpiresAt: input.leaseExpiresAt,
    };

    this.runs.set(leasedRun.id, clone(leasedRun));
    return clone(leasedRun);
  }

  async startRun(runId: EntityId, startedAt: string) {
    return this.updateRun(runId, { status: 'running', startedAt });
  }

  async blockRun(runId: EntityId, errorMessage: string, finishedAt: string) {
    return this.updateRun(runId, { status: 'blocked', errorMessage, finishedAt });
  }

  async completeRun(runId: EntityId, finishedAt: string) {
    return this.updateRun(runId, { status: 'completed', finishedAt });
  }

  async failRun(runId: EntityId, errorMessage: string, finishedAt: string) {
    return this.updateRun(runId, { status: 'failed', errorMessage, finishedAt });
  }

  async retryRun(runId: EntityId, queuedAt: string) {
    const run = this.runs.get(runId);

    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    return this.updateRun(runId, {
      status: 'queued',
      attempt: run.attempt + 1,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      errorMessage: undefined,
      queuedAt,
    });
  }

  async recoverExpiredRuns(now: string) {
    const recovered: Run[] = [];

    for (const run of this.runs.values()) {
      if (!canRecoverRun(run.status) || !run.leaseExpiresAt || run.leaseExpiresAt > now) {
        continue;
      }

      const nextStatus = run.attempt + 1 >= run.maxAttempts ? 'failed' : 'retrying';
      const recoveredRun: Run = {
        ...run,
        status: nextStatus,
        attempt: run.attempt + 1,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        errorMessage: nextStatus === 'failed' ? 'Run lease expired' : run.errorMessage,
      };

      this.runs.set(recoveredRun.id, clone(recoveredRun));
      recovered.push(clone(recoveredRun));
    }

    return recovered;
  }

  async createTask(task: Task) {
    this.tasks.set(task.id, clone(task));
    return clone(task);
  }

  async updateTask(task: Task) {
    this.tasks.set(task.id, clone(task));
    return clone(task);
  }

  async createArtifact(artifact: Artifact) {
    this.artifacts.set(artifact.id, clone(artifact));
    return clone(artifact);
  }

  async updateArtifact(artifact: Artifact) {
    this.artifacts.set(artifact.id, clone(artifact));
    return clone(artifact);
  }

  async createMemoryEntry(memoryEntry: MemoryEntry) {
    this.memoryEntries.set(memoryEntry.id, clone(memoryEntry));
    return clone(memoryEntry);
  }

  async createReport(report: ReportDocument) {
    this.reports.set(report.id, clone(report));
    return clone(report);
  }

  async createDecisionRequest(decisionRequest: DecisionRequest) {
    this.decisionRequests.set(decisionRequest.id, clone(decisionRequest));
    return clone(decisionRequest);
  }

  async resolveDecisionRequest(decisionRequestId: EntityId, resolvedAt: string) {
    const decisionRequest = this.decisionRequests.get(decisionRequestId);

    if (!decisionRequest) {
      throw new Error(`Decision request not found: ${decisionRequestId}`);
    }

    const resolved = { ...decisionRequest, resolvedAt };
    this.decisionRequests.set(resolved.id, clone(resolved));
    return clone(resolved);
  }

  async listCompanies() {
    return [...this.companies.values()].sort(byCreatedAt).map(clone);
  }

  async listAgents(companyId: EntityId) {
    return [...this.agents.values()].filter((agent) => agent.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listMessages(companyId: EntityId) {
    return [...this.messages.values()].filter((message) => message.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listEvents(companyId: EntityId) {
    return [...this.events.values()].filter((event) => event.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listRuns(companyId: EntityId) {
    return [...this.runs.values()].filter((run) => run.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listTasks(companyId: EntityId) {
    return [...this.tasks.values()].filter((task) => task.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listArtifacts(companyId: EntityId) {
    return [...this.artifacts.values()].filter((artifact) => artifact.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listMemoryEntries(companyId: EntityId) {
    return [...this.memoryEntries.values()].filter((entry) => entry.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listReports(companyId: EntityId) {
    return [...this.reports.values()].filter((report) => report.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  async listDecisionRequests(companyId: EntityId) {
    return [...this.decisionRequests.values()].filter((request) => request.companyId === companyId).sort(byCreatedAt).map(clone);
  }

  private updateRun(runId: EntityId, patch: Partial<Run>) {
    const run = this.runs.get(runId);

    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const updatedRun = { ...run, ...patch };
    this.runs.set(updatedRun.id, clone(updatedRun));
    return clone(updatedRun);
  }
}
