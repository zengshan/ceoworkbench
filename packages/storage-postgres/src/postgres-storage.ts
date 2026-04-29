import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import type {
  Agent,
  Artifact,
  Company,
  DecisionRequest,
  EntityId,
  MemoryEntry,
  Message,
  ReportDocument,
  RuntimeIncident,
  RuntimeIncidentEvent,
  Run,
  RunEvent,
  SupervisorHeartbeat,
  Task,
} from '../../core/src';
import type { LeaseRunInput, Storage } from '../../storage/src';
import { INITIAL_SCHEMA_SQL } from './schema';

export type PostgresStorageOptions = {
  connectionString: string;
};

export class PostgresStorage implements Storage {
  private readonly pool: Pool;

  constructor(options: PostgresStorageOptions) {
    this.pool = new Pool({ connectionString: options.connectionString });
  }

  async migrate() {
    await this.pool.query(INITIAL_SCHEMA_SQL);
  }

  async close() {
    await this.pool.end();
  }

  async createCompany(company: Company) {
    await this.pool.query(
      `INSERT INTO companies (id, name, goal, status, workspace_path, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [company.id, company.name, company.goal, company.status, company.workspacePath ?? null, company.createdAt, company.updatedAt],
    );
    return company;
  }

  async createAgent(agent: Agent) {
    await this.pool.query(
      `INSERT INTO agents (id, company_id, name, role, lifecycle, capabilities, sandbox_profile, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
      [
        agent.id,
        agent.companyId,
        agent.name,
        agent.role,
        agent.lifecycle,
        JSON.stringify(agent.capabilities),
        agent.sandboxProfile,
        agent.createdAt,
        agent.updatedAt,
      ],
    );
    return agent;
  }

  async appendMessage(message: Message) {
    await this.pool.query(
      `INSERT INTO messages (
        id, company_id, agent_id, from_agent_id, to_agent_id, run_id, task_id, artifact_id,
        author, kind, content, created_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        message.id,
        message.companyId,
        message.agentId ?? null,
        message.fromAgentId ?? null,
        message.toAgentId ?? null,
        message.runId ?? null,
        message.taskId ?? null,
        message.artifactId ?? null,
        message.author,
        message.kind,
        message.content,
        message.createdAt,
      ],
    );
    return message;
  }

  async appendRunEvent(event: RunEvent) {
    await this.pool.query(
      `INSERT INTO run_events (id, company_id, run_id, agent_id, type, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
      [event.id, event.companyId, event.runId ?? null, event.agentId ?? null, event.type, JSON.stringify(event.payload), event.createdAt],
    );
    return event;
  }

  async enqueueRun(run: Run) {
    await this.pool.query(
      `INSERT INTO runs (
        id, company_id, agent_id, trigger_message_id, kind, status, priority, attempt, max_attempts,
        lease_owner, lease_expires_at, queued_at, started_at, finished_at, error_message
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        run.id,
        run.companyId,
        run.agentId,
        run.triggerMessageId ?? null,
        run.kind,
        run.status,
        run.priority,
        run.attempt,
        run.maxAttempts,
        run.leaseOwner ?? null,
        run.leaseExpiresAt ?? null,
        run.queuedAt,
        run.startedAt ?? null,
        run.finishedAt ?? null,
        run.errorMessage ?? null,
      ],
    );
    return run;
  }

  async leaseNextRun(input: LeaseRunInput) {
    return this.withTransaction(async (client) => {
      const result = await client.query(
        `WITH next_run AS (
          SELECT r.id
          FROM runs r
          WHERE r.status IN ('queued', 'retrying')
            AND ($1::text IS NULL OR r.company_id = $1)
            AND NOT EXISTS (
              SELECT 1
              FROM runs active
              WHERE active.company_id = r.company_id
                AND active.status IN ('leasing', 'running')
            )
          ORDER BY r.priority DESC, r.queued_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE runs
        SET status = 'leasing',
            lease_owner = $2,
            lease_expires_at = $3
        WHERE id = (SELECT id FROM next_run)
        RETURNING *`,
        [input.companyId ?? null, input.leaseOwner, input.leaseExpiresAt],
      );
      return result.rows[0] ? rowToRun(result.rows[0]) : null;
    });
  }

  async startRun(runId: EntityId, startedAt: string) {
    return this.updateRun(runId, 'running', { startedAt });
  }

  async blockRun(runId: EntityId, errorMessage: string, finishedAt: string) {
    return this.updateRun(runId, 'blocked', { errorMessage, finishedAt });
  }

  async completeRun(runId: EntityId, finishedAt: string) {
    return this.updateRun(runId, 'completed', { finishedAt });
  }

  async failRun(runId: EntityId, errorMessage: string, finishedAt: string) {
    return this.updateRun(runId, 'failed', { errorMessage, finishedAt });
  }

  async retryRun(runId: EntityId, queuedAt: string) {
    const result = await this.pool.query(
      `UPDATE runs
       SET status = 'queued',
           attempt = attempt + 1,
           lease_owner = NULL,
           lease_expires_at = NULL,
           started_at = NULL,
           finished_at = NULL,
           error_message = NULL,
           queued_at = $2
       WHERE id = $1
       RETURNING *`,
      [runId, queuedAt],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Run not found: ${runId}`);
    }
    return rowToRun(row);
  }

  async recoverExpiredRuns(now: string) {
    const result = await this.pool.query(
      `UPDATE runs
       SET status = CASE WHEN attempt + 1 >= max_attempts THEN 'failed' ELSE 'retrying' END,
           attempt = attempt + 1,
           lease_owner = NULL,
           lease_expires_at = NULL,
           error_message = CASE WHEN attempt + 1 >= max_attempts THEN 'Run lease expired' ELSE error_message END
       WHERE status IN ('leasing', 'running')
         AND lease_expires_at IS NOT NULL
         AND lease_expires_at < $1
       RETURNING *`,
      [now],
    );
    return result.rows.map(rowToRun);
  }

  async createTask(task: Task) {
    await this.pool.query(
      `INSERT INTO tasks (
        id, company_id, assigned_agent_id, title, objective, expected_output, status, priority,
        dependency_task_ids, input_artifact_ids, output_artifact_ids, requires_review, pending_review_findings,
        created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13::jsonb, $14, $15)`,
      [
        task.id,
        task.companyId,
        task.assignedAgentId ?? null,
        task.title,
        task.objective,
        task.expectedOutput,
        task.status,
        task.priority,
        JSON.stringify(task.dependencyTaskIds),
        JSON.stringify(task.inputArtifactIds),
        JSON.stringify(task.outputArtifactIds),
        task.requiresReview,
        task.pendingReviewFindings ? JSON.stringify(task.pendingReviewFindings) : null,
        task.createdAt,
        task.updatedAt,
      ],
    );
    return task;
  }

  async updateTask(task: Task) {
    await this.pool.query(
      `UPDATE tasks
       SET assigned_agent_id = $2, title = $3, objective = $4, expected_output = $5, status = $6,
           priority = $7, dependency_task_ids = $8::jsonb, input_artifact_ids = $9::jsonb,
           output_artifact_ids = $10::jsonb, requires_review = $11, pending_review_findings = $12::jsonb,
           updated_at = $13
       WHERE id = $1`,
      [
        task.id,
        task.assignedAgentId ?? null,
        task.title,
        task.objective,
        task.expectedOutput,
        task.status,
        task.priority,
        JSON.stringify(task.dependencyTaskIds),
        JSON.stringify(task.inputArtifactIds),
        JSON.stringify(task.outputArtifactIds),
        task.requiresReview,
        task.pendingReviewFindings ? JSON.stringify(task.pendingReviewFindings) : null,
        task.updatedAt,
      ],
    );
    return task;
  }

  async createArtifact(artifact: Artifact) {
    await this.pool.query(
      `INSERT INTO artifacts (
        id, company_id, run_id, agent_id, task_id, path, title, artifact_type, kind, status,
        revision_self_report, created_at, updated_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)`,
      [
        artifact.id,
        artifact.companyId,
        artifact.runId ?? null,
        artifact.agentId ?? null,
        artifact.taskId ?? null,
        artifact.path,
        artifact.title,
        artifact.artifactType,
        artifact.kind ?? null,
        artifact.status,
        artifact.revisionSelfReport ? JSON.stringify(artifact.revisionSelfReport) : null,
        artifact.createdAt,
        artifact.updatedAt,
      ],
    );
    return artifact;
  }

  async updateArtifact(artifact: Artifact) {
    await this.pool.query(
      `UPDATE artifacts
       SET run_id = $2, agent_id = $3, task_id = $4, path = $5, title = $6,
           artifact_type = $7, kind = $8, status = $9, revision_self_report = $10::jsonb,
           updated_at = $11
       WHERE id = $1`,
      [
        artifact.id,
        artifact.runId ?? null,
        artifact.agentId ?? null,
        artifact.taskId ?? null,
        artifact.path,
        artifact.title,
        artifact.artifactType,
        artifact.kind ?? null,
        artifact.status,
        artifact.revisionSelfReport ? JSON.stringify(artifact.revisionSelfReport) : null,
        artifact.updatedAt,
      ],
    );
    return artifact;
  }

  async createMemoryEntry(memoryEntry: MemoryEntry) {
    await this.pool.query(
      `INSERT INTO memory_entries (id, company_id, kind, title, content, source_run_id, source_message_id, source_report_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        memoryEntry.id,
        memoryEntry.companyId,
        memoryEntry.kind,
        memoryEntry.title,
        memoryEntry.content,
        memoryEntry.sourceRunId ?? null,
        memoryEntry.sourceMessageId ?? null,
        memoryEntry.sourceReportId ?? null,
        memoryEntry.createdAt,
      ],
    );
    return memoryEntry;
  }

  async createReport(report: ReportDocument) {
    await this.pool.query(
      `INSERT INTO reports (
        id, company_id, title, report_type, scope, attention, time_range, headline, metrics,
        sections, tables, linked_tasks, linked_artifacts, linked_runs, linked_events,
        recommended_actions, created_at
      )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9::jsonb, $10::jsonb, $11::jsonb,
               $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb, $17)`,
      [
        report.id,
        report.companyId,
        report.title,
        report.reportType,
        JSON.stringify(report.scope),
        report.attention,
        JSON.stringify(report.timeRange),
        report.headline,
        JSON.stringify(report.metrics),
        JSON.stringify(report.sections),
        JSON.stringify(report.tables),
        JSON.stringify(report.linkedTasks),
        JSON.stringify(report.linkedArtifacts),
        JSON.stringify(report.linkedRuns),
        JSON.stringify(report.linkedEvents),
        JSON.stringify(report.recommendedActions),
        report.createdAt,
      ],
    );
    return report;
  }

  async createDecisionRequest(decisionRequest: DecisionRequest) {
    await this.pool.query(
      `INSERT INTO decision_requests (
        id, company_id, title, context, options, recommended_option_id, impact, deadline_at, created_at, resolved_at
      )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)`,
      [
        decisionRequest.id,
        decisionRequest.companyId,
        decisionRequest.title,
        decisionRequest.context,
        JSON.stringify(decisionRequest.options),
        decisionRequest.recommendedOptionId ?? null,
        decisionRequest.impact,
        decisionRequest.deadlineAt ?? null,
        decisionRequest.createdAt,
        decisionRequest.resolvedAt ?? null,
      ],
    );
    return decisionRequest;
  }

  async resolveDecisionRequest(decisionRequestId: EntityId, resolvedAt: string) {
    const result = await this.pool.query(
      `UPDATE decision_requests
       SET resolved_at = $2
       WHERE id = $1
       RETURNING *`,
      [decisionRequestId, resolvedAt],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Decision request not found: ${decisionRequestId}`);
    }
    return rowToDecisionRequest(row);
  }

  async createIncident(incident: RuntimeIncident) {
    await this.pool.query(
      `INSERT INTO runtime_incidents (
        id, company_id, kind, classification, status, title, summary, source_run_id,
        error_message, created_at, updated_at, resolved_at
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        incident.id,
        incident.companyId,
        incident.kind,
        incident.classification,
        incident.status,
        incident.title,
        incident.summary,
        incident.sourceRunId ?? null,
        incident.errorMessage ?? null,
        incident.createdAt,
        incident.updatedAt,
        incident.resolvedAt ?? null,
      ],
    );
    return incident;
  }

  async resolveIncident(incidentId: EntityId, resolvedAt: string) {
    const result = await this.pool.query(
      `UPDATE runtime_incidents
       SET status = 'resolved', resolved_at = $2, updated_at = $2
       WHERE id = $1
       RETURNING *`,
      [incidentId, resolvedAt],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Runtime incident not found: ${incidentId}`);
    }
    return rowToRuntimeIncident(row);
  }

  async appendIncidentEvent(event: RuntimeIncidentEvent) {
    await this.pool.query(
      `INSERT INTO runtime_incident_events (id, company_id, incident_id, type, payload, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [event.id, event.companyId, event.incidentId, event.type, JSON.stringify(event.payload), event.createdAt],
    );
    return event;
  }

  async recordSupervisorHeartbeat(heartbeat: SupervisorHeartbeat) {
    await this.pool.query(
      `INSERT INTO supervisor_heartbeats (company_id, lease_owner, checked_in_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (company_id, lease_owner)
       DO UPDATE SET checked_in_at = EXCLUDED.checked_in_at`,
      [heartbeat.companyId, heartbeat.leaseOwner, heartbeat.checkedInAt],
    );
    return heartbeat;
  }

  async listCompanies() {
    const result = await this.pool.query(`SELECT * FROM companies ORDER BY created_at ASC`);
    return result.rows.map(rowToCompany);
  }

  async listAgents(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM agents WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToAgent);
  }

  async listMessages(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM messages WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToMessage);
  }

  async listEvents(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM run_events WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToRunEvent);
  }

  async listRuns(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM runs WHERE company_id = $1 ORDER BY queued_at ASC`, [companyId]);
    return result.rows.map(rowToRun);
  }

  async listTasks(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM tasks WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToTask);
  }

  async listArtifacts(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM artifacts WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToArtifact);
  }

  async listMemoryEntries(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM memory_entries WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToMemoryEntry);
  }

  async listReports(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM reports WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToReport);
  }

  async listDecisionRequests(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM decision_requests WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToDecisionRequest);
  }

  async listIncidents(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM runtime_incidents WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToRuntimeIncident);
  }

  async listIncidentEvents(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM runtime_incident_events WHERE company_id = $1 ORDER BY created_at ASC`, [companyId]);
    return result.rows.map(rowToRuntimeIncidentEvent);
  }

  async listSupervisorHeartbeats(companyId: EntityId) {
    const result = await this.pool.query(`SELECT * FROM supervisor_heartbeats WHERE company_id = $1 ORDER BY checked_in_at ASC`, [companyId]);
    return result.rows.map(rowToSupervisorHeartbeat);
  }

  private async updateRun(runId: EntityId, status: Run['status'], patch: { startedAt?: string; finishedAt?: string; errorMessage?: string }) {
    const result = await this.pool.query(
      `UPDATE runs
       SET status = $2,
           started_at = COALESCE($3, started_at),
           finished_at = COALESCE($4, finished_at),
           error_message = COALESCE($5, error_message)
       WHERE id = $1
       RETURNING *`,
      [runId, status, patch.startedAt ?? null, patch.finishedAt ?? null, patch.errorMessage ?? null],
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error(`Run not found: ${runId}`);
    }
    return rowToRun(row);
  }

  private async withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function rowToCompany(row: QueryResultRow): Company {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: row.status,
    workspacePath: row.workspace_path ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function rowToAgent(row: QueryResultRow): Agent {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    role: row.role,
    lifecycle: row.lifecycle,
    capabilities: row.capabilities ?? [],
    sandboxProfile: row.sandbox_profile,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function rowToMessage(row: QueryResultRow): Message {
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id ?? undefined,
    fromAgentId: row.from_agent_id ?? undefined,
    toAgentId: row.to_agent_id ?? undefined,
    runId: row.run_id ?? undefined,
    taskId: row.task_id ?? undefined,
    artifactId: row.artifact_id ?? undefined,
    author: row.author,
    kind: row.kind,
    content: row.content,
    createdAt: toIso(row.created_at),
  };
}

function rowToRun(row: QueryResultRow): Run {
  return {
    id: row.id,
    companyId: row.company_id,
    agentId: row.agent_id,
    triggerMessageId: row.trigger_message_id ?? undefined,
    kind: row.kind,
    status: row.status,
    priority: row.priority,
    attempt: row.attempt,
    maxAttempts: row.max_attempts,
    leaseOwner: row.lease_owner ?? undefined,
    leaseExpiresAt: row.lease_expires_at ? toIso(row.lease_expires_at) : undefined,
    queuedAt: toIso(row.queued_at),
    startedAt: row.started_at ? toIso(row.started_at) : undefined,
    finishedAt: row.finished_at ? toIso(row.finished_at) : undefined,
    errorMessage: row.error_message ?? undefined,
  };
}

function rowToRunEvent(row: QueryResultRow): RunEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    runId: row.run_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    type: row.type,
    payload: row.payload ?? {},
    createdAt: toIso(row.created_at),
  };
}

function rowToTask(row: QueryResultRow): Task {
  return {
    id: row.id,
    companyId: row.company_id,
    assignedAgentId: row.assigned_agent_id ?? undefined,
    title: row.title,
    objective: row.objective,
    expectedOutput: row.expected_output,
    status: row.status,
    priority: row.priority,
    dependencyTaskIds: row.dependency_task_ids ?? [],
    inputArtifactIds: row.input_artifact_ids ?? [],
    outputArtifactIds: row.output_artifact_ids ?? [],
    requiresReview: row.requires_review,
    pendingReviewFindings: row.pending_review_findings ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function rowToArtifact(row: QueryResultRow): Artifact {
  return {
    id: row.id,
    companyId: row.company_id,
    runId: row.run_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    taskId: row.task_id ?? undefined,
    path: row.path,
    title: row.title,
    artifactType: row.artifact_type,
    kind: row.kind ?? undefined,
    status: row.status,
    revisionSelfReport: row.revision_self_report ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function rowToMemoryEntry(row: QueryResultRow): MemoryEntry {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind,
    title: row.title,
    content: row.content,
    sourceRunId: row.source_run_id ?? undefined,
    sourceMessageId: row.source_message_id ?? undefined,
    sourceReportId: row.source_report_id ?? undefined,
    createdAt: toIso(row.created_at),
  };
}

function rowToReport(row: QueryResultRow): ReportDocument {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    reportType: row.report_type,
    scope: row.scope,
    attention: row.attention,
    timeRange: row.time_range,
    headline: row.headline,
    metrics: row.metrics ?? [],
    sections: row.sections ?? [],
    tables: row.tables ?? [],
    linkedTasks: row.linked_tasks ?? [],
    linkedArtifacts: row.linked_artifacts ?? [],
    linkedRuns: row.linked_runs ?? [],
    linkedEvents: row.linked_events ?? [],
    recommendedActions: row.recommended_actions ?? [],
    createdAt: toIso(row.created_at),
  };
}

function rowToDecisionRequest(row: QueryResultRow): DecisionRequest {
  return {
    id: row.id,
    companyId: row.company_id,
    title: row.title,
    context: row.context,
    options: row.options ?? [],
    recommendedOptionId: row.recommended_option_id ?? undefined,
    impact: row.impact,
    deadlineAt: row.deadline_at ? toIso(row.deadline_at) : undefined,
    createdAt: toIso(row.created_at),
    resolvedAt: row.resolved_at ? toIso(row.resolved_at) : undefined,
  };
}

function rowToRuntimeIncident(row: QueryResultRow): RuntimeIncident {
  return {
    id: row.id,
    companyId: row.company_id,
    kind: row.kind,
    classification: row.classification,
    status: row.status,
    title: row.title,
    summary: row.summary,
    sourceRunId: row.source_run_id ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    resolvedAt: row.resolved_at ? toIso(row.resolved_at) : undefined,
  };
}

function rowToRuntimeIncidentEvent(row: QueryResultRow): RuntimeIncidentEvent {
  return {
    id: row.id,
    companyId: row.company_id,
    incidentId: row.incident_id,
    type: row.type,
    payload: row.payload ?? {},
    createdAt: toIso(row.created_at),
  };
}

function rowToSupervisorHeartbeat(row: QueryResultRow): SupervisorHeartbeat {
  return {
    companyId: row.company_id,
    leaseOwner: row.lease_owner,
    checkedInAt: toIso(row.checked_in_at),
  };
}

function toIso(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
