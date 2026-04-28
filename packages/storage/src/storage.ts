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

export type LeaseRunInput = {
  companyId?: EntityId;
  leaseOwner: string;
  leaseExpiresAt: string;
};

export type Storage = {
  createCompany(company: Company): Promise<Company>;
  createAgent(agent: Agent): Promise<Agent>;
  appendMessage(message: Message): Promise<Message>;
  appendRunEvent(event: RunEvent): Promise<RunEvent>;
  enqueueRun(run: Run): Promise<Run>;
  leaseNextRun(input: LeaseRunInput): Promise<Run | null>;
  startRun(runId: EntityId, startedAt: string): Promise<Run>;
  blockRun(runId: EntityId, errorMessage: string, finishedAt: string): Promise<Run>;
  completeRun(runId: EntityId, finishedAt: string): Promise<Run>;
  failRun(runId: EntityId, errorMessage: string, finishedAt: string): Promise<Run>;
  retryRun(runId: EntityId, queuedAt: string): Promise<Run>;
  recoverExpiredRuns(now: string): Promise<Run[]>;
  createTask(task: Task): Promise<Task>;
  updateTask(task: Task): Promise<Task>;
  createArtifact(artifact: Artifact): Promise<Artifact>;
  updateArtifact(artifact: Artifact): Promise<Artifact>;
  createMemoryEntry(memoryEntry: MemoryEntry): Promise<MemoryEntry>;
  createReport(report: ReportDocument): Promise<ReportDocument>;
  createDecisionRequest(decisionRequest: DecisionRequest): Promise<DecisionRequest>;
  resolveDecisionRequest(decisionRequestId: EntityId, resolvedAt: string): Promise<DecisionRequest>;
  listCompanies(): Promise<Company[]>;
  listAgents(companyId: EntityId): Promise<Agent[]>;
  listMessages(companyId: EntityId): Promise<Message[]>;
  listEvents(companyId: EntityId): Promise<RunEvent[]>;
  listRuns(companyId: EntityId): Promise<Run[]>;
  listTasks(companyId: EntityId): Promise<Task[]>;
  listArtifacts(companyId: EntityId): Promise<Artifact[]>;
  listMemoryEntries(companyId: EntityId): Promise<MemoryEntry[]>;
  listReports(companyId: EntityId): Promise<ReportDocument[]>;
  listDecisionRequests(companyId: EntityId): Promise<DecisionRequest[]>;
};
