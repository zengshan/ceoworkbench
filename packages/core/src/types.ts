export type EntityId = string;
export type ISODateTime = string;

export type CompanyStatus = 'active' | 'paused' | 'archived';

export type AgentRole = 'manager' | 'worker' | 'reviewer' | 'reporter';
export type AgentLifecycle = 'on_demand' | 'always_on';

export type MessageAuthor = 'ceo' | 'agent' | 'system';
export type MessageKind = 'steer' | 'follow_up' | 'decision' | 'report';

export type RunStatus =
  | 'queued'
  | 'leasing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'blocked'
  | 'cancelled';

export type RunKind = 'ceo_steer' | 'ceo_decision' | 'recovery' | 'continuation' | 'reflection';

export type RunEventType =
  | 'message_created'
  | 'run_queued'
  | 'run_leased'
  | 'run_started'
  | 'agent_created'
  | 'agent_event_emitted'
  | 'task_created'
  | 'artifact_created'
  | 'decision_required'
  | 'memory_updated'
  | 'report_created'
  | 'run_completed'
  | 'run_failed'
  | 'run_cancelled';

export type TaskStatus = 'queued' | 'running' | 'submitted' | 'in_review' | 'completed' | 'blocked' | 'failed' | 'escalated';
export type ArtifactStatus = 'draft' | 'submitted' | 'reviewed' | 'accepted' | 'rejected' | 'final';
export type ReviewFindingSeverity = 'blocker' | 'major' | 'minor' | 'nit';

export type ReviewFinding = {
  id: string;
  severity: ReviewFindingSeverity;
  location: string;
  description: string;
  suggestedFix?: string;
  mustAddress: boolean;
};

export type RevisionFindingResponse = {
  findingId: string;
  status: 'addressed' | 'not_addressed';
  note: string;
};

export type RevisionSelfReport = {
  findingResponses: RevisionFindingResponse[];
};

export type MemoryKind = 'goal' | 'decision' | 'fact' | 'lesson' | 'phase_summary' | 'project_summary';

export type ReportType =
  | 'status'
  | 'heartbeat'
  | 'progress'
  | 'decision_briefing'
  | 'failure'
  | 'phase'
  | 'completion'
  | 'agent_activity'
  | 'artifact_index'
  | 'execution_report'
  | 'review_report'
  | 'acceptance_report'
  | 'handoff_report';

export type ReportAttention = 'info' | 'notice' | 'requires_decision' | 'warning' | 'critical' | 'completed';

export type Company = {
  id: EntityId;
  name: string;
  goal: string;
  status: CompanyStatus;
  workspacePath?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Agent = {
  id: EntityId;
  companyId: EntityId;
  name: string;
  role: AgentRole;
  lifecycle: AgentLifecycle;
  capabilities: string[];
  sandboxProfile: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Message = {
  id: EntityId;
  companyId: EntityId;
  agentId?: EntityId;
  author: MessageAuthor;
  kind: MessageKind;
  content: string;
  createdAt: ISODateTime;
};

export type Run = {
  id: EntityId;
  companyId: EntityId;
  agentId: EntityId;
  triggerMessageId?: EntityId;
  kind: RunKind;
  status: RunStatus;
  priority: number;
  attempt: number;
  maxAttempts: number;
  leaseOwner?: string;
  leaseExpiresAt?: ISODateTime;
  queuedAt: ISODateTime;
  startedAt?: ISODateTime;
  finishedAt?: ISODateTime;
  errorMessage?: string;
};

export type RunEvent = {
  id: EntityId;
  companyId: EntityId;
  runId?: EntityId;
  agentId?: EntityId;
  type: RunEventType;
  payload: Record<string, unknown>;
  createdAt: ISODateTime;
};

export type Task = {
  id: EntityId;
  companyId: EntityId;
  assignedAgentId?: EntityId;
  title: string;
  objective: string;
  expectedOutput: string;
  status: TaskStatus;
  priority: number;
  dependencyTaskIds: EntityId[];
  inputArtifactIds: EntityId[];
  outputArtifactIds: EntityId[];
  requiresReview: boolean;
  pendingReviewFindings?: ReviewFinding[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type Artifact = {
  id: EntityId;
  companyId: EntityId;
  runId?: EntityId;
  agentId?: EntityId;
  taskId?: EntityId;
  path: string;
  title: string;
  artifactType: string;
  kind?: string;
  status: ArtifactStatus;
  content?: string;
  revisionSelfReport?: RevisionSelfReport;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type MemoryEntry = {
  id: EntityId;
  companyId: EntityId;
  kind: MemoryKind;
  title: string;
  content: string;
  sourceRunId?: EntityId;
  sourceMessageId?: EntityId;
  sourceReportId?: EntityId;
  createdAt: ISODateTime;
};

export type ReportMetric = {
  label: string;
  value: string;
  tone?: ReportAttention;
};

export type ReportSection = {
  title: string;
  body: string;
  items?: string[];
};

export type ReportTable = {
  title: string;
  columns: string[];
  rows: string[][];
};

export type ReportDocument = {
  id: EntityId;
  companyId: EntityId;
  title: string;
  reportType: ReportType;
  scope: {
    type: 'company' | 'agent' | 'run' | 'task' | 'phase';
    id?: string;
  };
  attention: ReportAttention;
  timeRange: {
    from: ISODateTime;
    to: ISODateTime;
  };
  headline: string;
  metrics: ReportMetric[];
  sections: ReportSection[];
  tables: ReportTable[];
  linkedTasks: EntityId[];
  linkedArtifacts: EntityId[];
  linkedRuns: EntityId[];
  linkedEvents: EntityId[];
  recommendedActions: string[];
  createdAt: ISODateTime;
};

export type DecisionOption = {
  id: string;
  label: string;
  tradeoff: string;
};

export type DecisionRequest = {
  id: EntityId;
  companyId: EntityId;
  title: string;
  context: string;
  options: DecisionOption[];
  recommendedOptionId?: string;
  impact: string;
  deadlineAt?: ISODateTime;
  createdAt: ISODateTime;
  resolvedAt?: ISODateTime;
};
