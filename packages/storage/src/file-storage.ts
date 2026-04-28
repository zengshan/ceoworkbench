import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  Agent,
  Artifact,
  Company,
  DecisionRequest,
  EntityId,
  MemoryEntry,
  Message,
  ReportDocument,
  Run,
  RunEvent,
  Task,
} from '../../core/src';
import { MemoryStorage } from './memory-storage';
import type { LeaseRunInput } from './storage';

type FileStorageSnapshot = {
  companies: Company[];
  agents: Agent[];
  messages: Message[];
  runs: Run[];
  events: RunEvent[];
  tasks: Task[];
  artifacts: Artifact[];
  memoryEntries: MemoryEntry[];
  reports: ReportDocument[];
  decisionRequests: DecisionRequest[];
};

export class FileStorage extends MemoryStorage {
  private loading = false;

  constructor(private readonly filePath: string) {
    super();
    this.load();
  }

  async createCompany(company: Company) {
    const result = await super.createCompany(company);
    await this.persist();
    return result;
  }

  async createAgent(agent: Agent) {
    const result = await super.createAgent(agent);
    await this.persist();
    return result;
  }

  async appendMessage(message: Message) {
    const result = await super.appendMessage(message);
    await this.persist();
    return result;
  }

  async appendRunEvent(event: RunEvent) {
    const result = await super.appendRunEvent(event);
    await this.persist();
    return result;
  }

  async enqueueRun(run: Run) {
    const result = await super.enqueueRun(run);
    await this.persist();
    return result;
  }

  async leaseNextRun(input: LeaseRunInput) {
    const result = await super.leaseNextRun(input);
    if (result) {
      await this.persist();
    }
    return result;
  }

  async startRun(runId: EntityId, startedAt: string) {
    const result = await super.startRun(runId, startedAt);
    await this.persist();
    return result;
  }

  async blockRun(runId: EntityId, errorMessage: string, finishedAt: string) {
    const result = await super.blockRun(runId, errorMessage, finishedAt);
    await this.persist();
    return result;
  }

  async completeRun(runId: EntityId, finishedAt: string) {
    const result = await super.completeRun(runId, finishedAt);
    await this.persist();
    return result;
  }

  async failRun(runId: EntityId, errorMessage: string, finishedAt: string) {
    const result = await super.failRun(runId, errorMessage, finishedAt);
    await this.persist();
    return result;
  }

  async retryRun(runId: EntityId, queuedAt: string) {
    const result = await super.retryRun(runId, queuedAt);
    await this.persist();
    return result;
  }

  async recoverExpiredRuns(now: string) {
    const result = await super.recoverExpiredRuns(now);
    if (result.length > 0) {
      await this.persist();
    }
    return result;
  }

  async createTask(task: Task) {
    const result = await super.createTask(task);
    await this.persist();
    return result;
  }

  async updateTask(task: Task) {
    const result = await super.updateTask(task);
    await this.persist();
    return result;
  }

  async createArtifact(artifact: Artifact) {
    const result = await super.createArtifact(artifact);
    await this.persist();
    return result;
  }

  async updateArtifact(artifact: Artifact) {
    const result = await super.updateArtifact(artifact);
    await this.persist();
    return result;
  }

  async createMemoryEntry(memoryEntry: MemoryEntry) {
    const result = await super.createMemoryEntry(memoryEntry);
    await this.persist();
    return result;
  }

  async createReport(report: ReportDocument) {
    const result = await super.createReport(report);
    await this.persist();
    return result;
  }

  async createDecisionRequest(decisionRequest: DecisionRequest) {
    const result = await super.createDecisionRequest(decisionRequest);
    await this.persist();
    return result;
  }

  async resolveDecisionRequest(decisionRequestId: EntityId, resolvedAt: string) {
    const result = await super.resolveDecisionRequest(decisionRequestId, resolvedAt);
    await this.persist();
    return result;
  }

  private load() {
    if (!existsSync(this.filePath)) {
      return;
    }

    const snapshot = JSON.parse(readFileSync(this.filePath, 'utf8')) as FileStorageSnapshot;
    this.loading = true;

    try {
      for (const company of snapshot.companies ?? []) {
        void super.createCompany(company);
      }
      for (const agent of snapshot.agents ?? []) {
        void super.createAgent(agent);
      }
      for (const message of snapshot.messages ?? []) {
        void super.appendMessage(message);
      }
      for (const run of snapshot.runs ?? []) {
        void super.enqueueRun(run);
      }
      for (const event of snapshot.events ?? []) {
        void super.appendRunEvent(event);
      }
      for (const task of snapshot.tasks ?? []) {
        void super.createTask(task);
      }
      for (const artifact of snapshot.artifacts ?? []) {
        void super.createArtifact(artifact);
      }
      for (const memoryEntry of snapshot.memoryEntries ?? []) {
        void super.createMemoryEntry(memoryEntry);
      }
      for (const report of snapshot.reports ?? []) {
        void super.createReport(report);
      }
      for (const decisionRequest of snapshot.decisionRequests ?? []) {
        void super.createDecisionRequest(decisionRequest);
      }
    } finally {
      this.loading = false;
    }
  }

  private async persist() {
    if (this.loading) {
      return;
    }

    const companies = await super.listCompanies();
    const snapshot: FileStorageSnapshot = {
      companies,
      agents: (await Promise.all(companies.map((company) => super.listAgents(company.id)))).flat(),
      messages: (await Promise.all(companies.map((company) => super.listMessages(company.id)))).flat(),
      runs: (await Promise.all(companies.map((company) => super.listRuns(company.id)))).flat(),
      events: (await Promise.all(companies.map((company) => super.listEvents(company.id)))).flat(),
      tasks: (await Promise.all(companies.map((company) => super.listTasks(company.id)))).flat(),
      artifacts: (await Promise.all(companies.map((company) => super.listArtifacts(company.id)))).flat(),
      memoryEntries: (await Promise.all(companies.map((company) => super.listMemoryEntries(company.id)))).flat(),
      reports: (await Promise.all(companies.map((company) => super.listReports(company.id)))).flat(),
      decisionRequests: (await Promise.all(companies.map((company) => super.listDecisionRequests(company.id)))).flat(),
    };

    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  }
}
