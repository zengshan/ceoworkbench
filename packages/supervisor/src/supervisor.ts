import {
  getRunKindForMessage,
  getRunPriority,
  decideReviewTransition,
  pickReviewer,
  validateRevisionSelfReport,
  type Agent,
  type AgentLifecycle,
  type AgentRole,
  type Artifact,
  type Clock,
  type IdGenerator,
  type Message,
  type ReportDocument,
  type ReviewReport,
  type Run,
  type RunEvent,
  type Task,
} from '../../core/src';
import type { AgentAdapter } from '../../runtime/src';
import type { AgentDelegationRequest } from '../../runtime/src';
import { buildAgentContext } from '../../runtime/src';
import type { Storage } from '../../storage/src';
import { classifyRuntimeError, shouldEscalateTransientFailure } from './runtime-health';

export type SupervisorOptions = {
  storage: Storage;
  adapter: AgentAdapter;
  clock: Clock;
  ids: IdGenerator;
  leaseOwner: string;
  leaseMs?: number;
  writeArtifact?: (artifact: Artifact) => Promise<void>;
};

export class Supervisor {
  private readonly leaseMs: number;

  constructor(private readonly options: SupervisorOptions) {
    this.leaseMs = options.leaseMs ?? 60_000;
  }

  async handleMessage(message: Message, agent: Agent) {
    await this.options.storage.appendMessage(message);
    await this.options.storage.appendRunEvent(this.event('message_created', message.companyId, {
      messageId: message.id,
      agentId: agent.id,
      fromAgentId: message.fromAgentId,
      toAgentId: message.toAgentId,
      runId: message.runId,
      taskId: message.taskId,
      artifactId: message.artifactId,
      kind: message.kind,
    }, message.runId, message.toAgentId ?? agent.id));

    const runKind = getRunKindForMessage(message.kind);
    const run: Run = {
      id: this.options.ids.next('run'),
      companyId: message.companyId,
      agentId: agent.id,
      triggerMessageId: message.id,
      kind: runKind,
      status: 'queued',
      priority: getRunPriority(runKind),
      attempt: 0,
      maxAttempts: 3,
      queuedAt: this.options.clock.now(),
    };

    await this.options.storage.enqueueRun(run);
    await this.options.storage.appendRunEvent(this.event('run_queued', run.companyId, {
      runId: run.id,
      agentId: run.agentId,
      priority: run.priority,
    }, run.id, run.agentId));

    return run;
  }

  async tick(companyId?: string) {
    const now = this.options.clock.now();
    if (companyId) {
      await this.options.storage.recordSupervisorHeartbeat({
        companyId,
        leaseOwner: this.options.leaseOwner,
        checkedInAt: now,
      });
    }
    const leaseExpiresAt = new Date(Date.parse(now) + this.leaseMs).toISOString();
    const leasedRun = await this.options.storage.leaseNextRun({
      companyId,
      leaseOwner: this.options.leaseOwner,
      leaseExpiresAt,
    });

    if (!leasedRun) {
      return null;
    }

    await this.options.storage.appendRunEvent(this.event('run_leased', leasedRun.companyId, {
      runId: leasedRun.id,
      leaseOwner: this.options.leaseOwner,
      leaseExpiresAt,
    }, leasedRun.id, leasedRun.agentId));

    const runningRun = await this.options.storage.startRun(leasedRun.id, now);
    await this.options.storage.appendRunEvent(this.event('run_started', runningRun.companyId, {
      runId: runningRun.id,
    }, runningRun.id, runningRun.agentId));

    try {
      const context = await buildAgentContext(this.options.storage, runningRun);
      const result = await this.options.adapter.runStep(context);

      for (const event of result.events) {
        await this.options.storage.appendRunEvent(event);
      }

      for (const task of result.tasks ?? []) {
        const created = await this.saveTask(task);

        if (created) {
          await this.options.storage.appendRunEvent(this.event('task_created', task.companyId, {
            taskId: task.id,
            title: task.title,
          }, runningRun.id, runningRun.agentId));
        }
      }

      for (const delegation of result.delegations ?? []) {
        await this.delegateTask(runningRun, delegation);
      }

      for (const artifact of result.artifacts ?? []) {
        const artifactForReview = await this.attachArtifactToReviewTask(runningRun, artifact);
        await this.options.writeArtifact?.(artifactForReview);
        await this.options.storage.createArtifact(artifactForReview);
        await this.options.storage.appendRunEvent(this.event('artifact_created', artifactForReview.companyId, {
          artifactId: artifactForReview.id,
          path: artifactForReview.path,
        }, runningRun.id, runningRun.agentId));
        await this.queueReviewIfRequired(runningRun, artifactForReview);
      }

      for (const reviewReport of result.reviewReports ?? []) {
        await this.applyReviewReport(runningRun, reviewReport);
      }

      for (const memoryEntry of result.memoryEntries ?? []) {
        await this.options.storage.createMemoryEntry(memoryEntry);
        await this.options.storage.appendRunEvent(this.event('memory_updated', memoryEntry.companyId, {
          memoryEntryId: memoryEntry.id,
          kind: memoryEntry.kind,
        }, runningRun.id, runningRun.agentId));
      }

      for (const decisionRequest of result.decisionRequests ?? []) {
        await this.options.storage.createDecisionRequest(decisionRequest);
        await this.options.storage.appendRunEvent(this.event('decision_required', decisionRequest.companyId, {
          decisionRequestId: decisionRequest.id,
          title: decisionRequest.title,
        }, runningRun.id, runningRun.agentId));
      }

      if (this.shouldRetryStructuredOutput(result, context.messages.at(-1))) {
        await this.queueStructuredOutputRetry(runningRun, context.messages.at(-1), result.artifacts?.at(-1));
      }

      if (result.blocked) {
        const finishedAt = this.options.clock.now();
        await this.options.storage.blockRun(runningRun.id, 'Run blocked by decision request', finishedAt);
        return runningRun;
      }

      await this.options.storage.completeRun(runningRun.id, this.options.clock.now());
      await this.options.storage.appendRunEvent(this.event('run_completed', runningRun.companyId, {
        runId: runningRun.id,
      }, runningRun.id, runningRun.agentId));

      return runningRun;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown supervisor error';
      await this.options.storage.failRun(runningRun.id, message, this.options.clock.now());
      await this.options.storage.appendRunEvent(this.event('run_failed', runningRun.companyId, {
        runId: runningRun.id,
        errorMessage: message,
      }, runningRun.id, runningRun.agentId));
      await this.recordRuntimeFailureIncident(runningRun, message);
      return runningRun;
    }
  }

  private async recordRuntimeFailureIncident(run: Run, errorMessage: string) {
    const now = this.options.clock.now();
    const classification = classifyRuntimeError(errorMessage);
    const events = await this.options.storage.listEvents(run.companyId);
    const shouldCreateIncident = classification === 'persistent' || shouldEscalateTransientFailure(events, now);

    if (!shouldCreateIncident) {
      return;
    }

    const incidents = await this.options.storage.listIncidents(run.companyId);
    const hasActiveIncident = incidents.some((incident) => (
      incident.status === 'active'
      && (incident.kind === 'llm.persistent_error' || incident.kind === 'llm.transient_error')
    ));

    if (hasActiveIncident) {
      return;
    }

    const incident = {
      id: this.options.ids.next('incident'),
      companyId: run.companyId,
      kind: classification === 'persistent' ? 'llm.persistent_error' as const : 'llm.transient_error' as const,
      classification: 'persistent' as const,
      status: 'active' as const,
      title: classification === 'persistent'
        ? 'AI service requires external intervention'
        : 'AI service transient failures exceeded retry threshold',
      summary: classification === 'persistent'
        ? 'The agent runtime received a non-retryable AI service error. Fix credentials, billing, permissions, or configuration before more work runs.'
        : 'The agent runtime saw 8 retryable failures within 10 minutes without an intervening success. Treat this as requiring operator intervention.',
      sourceRunId: run.id,
      errorMessage,
      createdAt: now,
      updatedAt: now,
    };

    await this.options.storage.createIncident(incident);
    await this.options.storage.appendIncidentEvent({
      id: this.options.ids.next('incident-event'),
      companyId: run.companyId,
      incidentId: incident.id,
      type: 'incident_created',
      payload: {
        kind: incident.kind,
        classification: incident.classification,
        sourceRunId: run.id,
      },
      createdAt: now,
    });
  }

  private async delegateTask(sourceRun: Run, delegation: AgentDelegationRequest) {
    const now = this.options.clock.now();
    const agent = await this.findOrCreateDelegatedAgent(sourceRun.companyId, delegation, now, sourceRun);
    const task = {
      id: this.options.ids.next('task'),
      companyId: sourceRun.companyId,
      assignedAgentId: agent.id,
      title: delegation.title ?? `Delegated task for ${agent.name}`,
      objective: delegation.objective,
      expectedOutput: delegation.expectedOutput,
      status: 'queued' as const,
      priority: delegation.priority ?? getRunPriority('continuation'),
      dependencyTaskIds: [],
      inputArtifactIds: [],
      outputArtifactIds: [],
      requiresReview: delegation.requiresReview ?? true,
      createdAt: now,
      updatedAt: now,
    };

    await this.options.storage.createTask(task);
    await this.options.storage.appendRunEvent(this.event('task_created', task.companyId, {
      taskId: task.id,
      title: task.title,
      delegatedByRunId: sourceRun.id,
    }, sourceRun.id, sourceRun.agentId));

    const message: Message = {
      id: this.options.ids.next('message'),
      companyId: sourceRun.companyId,
      agentId: agent.id,
      fromAgentId: sourceRun.agentId,
      toAgentId: agent.id,
      runId: sourceRun.id,
      taskId: task.id,
      author: 'system',
      kind: 'follow_up',
      content: [
        delegation.objective,
        '',
        `Expected output: ${delegation.expectedOutput}`,
      ].join('\n'),
      createdAt: now,
    };

    await this.handleMessage(message, agent);
  }

  private async saveTask(task: Task) {
    const existingTask = (await this.options.storage.listTasks(task.companyId))
      .find((candidate) => candidate.id === task.id);

    if (existingTask) {
      await this.options.storage.updateTask(task);
      return false;
    }

    await this.options.storage.createTask(task);
    return true;
  }

  private shouldRetryStructuredOutput(result: Awaited<ReturnType<AgentAdapter['runStep']>>, sourceMessage?: Message) {
    if (!result.structuredOutputFallback) {
      return false;
    }

    if (sourceMessage?.content.includes('STRUCTURED_OUTPUT_RETRY')) {
      return false;
    }

    return !(
      result.delegations?.length
      || result.tasks?.length
      || result.reviewReports?.length
      || result.decisionRequests?.length
    );
  }

  private async queueStructuredOutputRetry(sourceRun: Run, sourceMessage?: Message, artifact?: Artifact) {
    const agent = (await this.options.storage.listAgents(sourceRun.companyId))
      .find((candidate) => candidate.id === sourceRun.agentId);
    const message: Message = {
      id: this.options.ids.next('message'),
      companyId: sourceRun.companyId,
      agentId: sourceRun.agentId,
      fromAgentId: sourceRun.agentId,
      toAgentId: sourceRun.agentId,
      runId: sourceRun.id,
      artifactId: artifact?.id,
      author: 'system',
      kind: 'follow_up',
      content: [
        'STRUCTURED_OUTPUT_RETRY',
        'Your previous response was narrative text and did not create structured CEO Workbench work.',
        'Read the previous message, company memory, and the saved narrative artifact, then return only a valid JSON AgentStepResult.',
        'Managers must create tasks and delegations for concrete next work. Workers must create artifacts. Reviewers must create reviewReports.',
        artifact ? `Narrative artifact to convert: ${artifact.id} (${artifact.path})` : undefined,
      ].filter(Boolean).join('\n'),
      createdAt: this.options.clock.now(),
    };

    await this.options.storage.appendRunEvent(this.event('agent_event_emitted', sourceRun.companyId, {
      eventKind: 'structured_output_retry_queued',
      text: 'Agent returned narrative output without structured work; queued a structured-output retry.',
      sourceRunId: sourceRun.id,
      artifactId: artifact?.id,
    }, sourceRun.id, sourceRun.agentId));

    if (agent) {
      await this.handleMessage(message, agent);
    }
  }

  private async attachArtifactToReviewTask(sourceRun: Run, artifact: Artifact) {
    const [agents, tasks] = await Promise.all([
      this.options.storage.listAgents(artifact.companyId),
      this.options.storage.listTasks(artifact.companyId),
    ]);
    const agent = agents.find((candidate) => candidate.id === sourceRun.agentId);

    if (agent?.role !== 'worker') {
      return artifact;
    }

    const artifactTask = artifact.taskId
      ? tasks.find((candidate) => candidate.id === artifact.taskId)
      : undefined;

    if (artifactTask?.assignedAgentId === sourceRun.agentId) {
      return artifact;
    }

    const task = [...tasks]
      .reverse()
      .find((candidate) => (
        candidate.assignedAgentId === sourceRun.agentId
        && candidate.requiresReview
        && candidate.status !== 'completed'
        && candidate.status !== 'failed'
        && candidate.status !== 'escalated'
      ));

    return task ? { ...artifact, taskId: task.id } : artifact;
  }

  private async queueReviewIfRequired(sourceRun: Run, artifact: Artifact) {
    if (!artifact.taskId) {
      return;
    }

    const [tasks, agents, runs] = await Promise.all([
      this.options.storage.listTasks(artifact.companyId),
      this.options.storage.listAgents(artifact.companyId),
      this.options.storage.listRuns(artifact.companyId),
    ]);
    const task = tasks.find((candidate) => candidate.id === artifact.taskId);

    if (!task?.requiresReview) {
      return;
    }

    const assignedAgent = agents.find((agent) => agent.id === task.assignedAgentId);

    if (assignedAgent?.role !== 'worker') {
      return;
    }

    if (task.pendingReviewFindings?.length) {
      const validation = validateRevisionSelfReport({
        previousFindings: task.pendingReviewFindings,
        selfReport: artifact.revisionSelfReport ?? { findingResponses: [] },
      });

      if (!validation.valid) {
        await this.rejectInvalidRevision(sourceRun, task, artifact, validation);
        return;
      }
    }

    const artifactKind = artifact.kind ?? artifact.artifactType;
    const reviewers = await this.ensureReviewerForKind(artifact.companyId, artifactKind, sourceRun, agents);
    const result = pickReviewer({
      artifactId: artifact.id,
      artifactKind,
      candidates: reviewers
        .filter((agent) => agent.role === 'reviewer')
        .map((agent) => ({
          ...agent,
          reviews: agent.capabilities
            .filter((capability) => capability.startsWith('review:'))
            .map((capability) => capability.slice('review:'.length)),
          activeReviewCount: runs.filter((run) => run.agentId === agent.id && (run.status === 'queued' || run.status === 'running')).length,
          available: true,
        })),
    });

    if (result.type === 'unavailable') {
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', artifact.companyId, {
        eventKind: 'reviewer_unavailable',
        artifactId: artifact.id,
        taskId: task.id,
        artifactKind,
      }, sourceRun.id, sourceRun.agentId));
      return;
    }

    await this.options.storage.updateTask(markTaskInReview(task, artifact.id, this.options.clock.now()));
    const reviewer = reviewers.find((agent) => agent.id === result.reviewerId)!;
    await this.options.storage.appendRunEvent(this.event('agent_event_emitted', artifact.companyId, {
      eventKind: 'review_queued',
      text: `Artifact ${artifact.path} entered review with ${reviewer.name}.`,
      artifactId: artifact.id,
      taskId: task.id,
      reviewerId: reviewer.id,
      artifactKind,
    }, sourceRun.id, sourceRun.agentId));

    const message: Message = {
      id: this.options.ids.next('message'),
      companyId: artifact.companyId,
      agentId: result.reviewerId,
      fromAgentId: sourceRun.agentId,
      toAgentId: result.reviewerId,
      runId: sourceRun.id,
      taskId: task.id,
      artifactId: artifact.id,
      author: 'system',
      kind: 'follow_up',
      content: [
        `Review artifact ${artifact.id} for task ${task.id}.`,
        '',
        `Artifact kind: ${artifactKind}`,
        `Reviewer changed: ${result.reviewerChanged ? 'true' : 'false'}`,
      ].join('\n'),
      createdAt: this.options.clock.now(),
    };

    await this.handleMessage(message, reviewer);
  }

  private async ensureReviewerForKind(companyId: string, artifactKind: string, sourceRun: Run, agents: Agent[]) {
    const hasMatchingReviewer = agents.some((agent) => (
      agent.role === 'reviewer'
      && agent.capabilities.includes(`review:${artifactKind}`)
    ));

    if (hasMatchingReviewer) {
      return agents;
    }

    const now = this.options.clock.now();
    const reviewer: Agent = {
      id: this.options.ids.next('agent'),
      companyId,
      name: `${artifactKind}-reviewer`,
      role: 'reviewer',
      lifecycle: 'on_demand',
      capabilities: [`review:${artifactKind}`],
      sandboxProfile: 'podman-default',
      createdAt: now,
      updatedAt: now,
    };

    await this.options.storage.createAgent(reviewer);
    await this.options.storage.appendRunEvent(this.event('agent_created', companyId, {
      agentId: reviewer.id,
      name: reviewer.name,
      role: reviewer.role,
      reviewKind: artifactKind,
      delegatedByRunId: sourceRun.id,
    }, sourceRun.id, sourceRun.agentId));

    return [...agents, reviewer];
  }

  private async applyReviewReport(sourceRun: Run, reviewReport: ReviewReport) {
    const [tasks, artifacts] = await Promise.all([
      this.options.storage.listTasks(sourceRun.companyId),
      this.options.storage.listArtifacts(sourceRun.companyId),
    ]);
    const task = tasks.find((candidate) => candidate.id === reviewReport.taskId);
    const artifact = artifacts.find((candidate) => candidate.id === reviewReport.artifactId);

    if (!task || !artifact) {
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', sourceRun.companyId, {
        eventKind: 'review_target_missing',
        taskId: reviewReport.taskId,
        artifactId: reviewReport.artifactId,
      }, sourceRun.id, sourceRun.agentId));
      return;
    }

    const report = this.reviewReportDocument(sourceRun, reviewReport);
    await this.options.storage.createReport(report);
    await this.options.storage.appendRunEvent(this.event('report_created', sourceRun.companyId, {
      reportId: report.id,
      reportType: report.reportType,
      taskId: reviewReport.taskId,
      artifactId: reviewReport.artifactId,
    }, sourceRun.id, sourceRun.agentId));

    const transition = decideReviewTransition(reviewReport);
    const now = this.options.clock.now();

    if (transition.type === 'complete') {
      await this.options.storage.updateTask({
        ...task,
        status: 'completed',
        pendingReviewFindings: undefined,
        updatedAt: now,
      });
      await this.options.storage.updateArtifact({ ...artifact, status: 'accepted', updatedAt: now });
    } else if (transition.type === 'revise') {
      await this.options.storage.updateTask({
        ...task,
        status: 'running',
        pendingReviewFindings: reviewReport.findings.filter((finding) => finding.mustAddress),
        updatedAt: now,
      });
      await this.options.storage.updateArtifact({ ...artifact, status: 'rejected', updatedAt: now });
      await this.queueRevisionRun(sourceRun, task, artifact, reviewReport);
    } else if (transition.type === 'block') {
      await this.options.storage.updateTask({ ...task, status: 'blocked', updatedAt: now });
      await this.options.storage.updateArtifact({ ...artifact, status: 'rejected', updatedAt: now });
    } else if (transition.type === 'second_opinion') {
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', sourceRun.companyId, {
        eventKind: 'second_opinion_required',
        reason: transition.reason,
        taskId: task.id,
        artifactId: artifact.id,
      }, sourceRun.id, sourceRun.agentId));
    } else if (transition.type === 'escalate') {
      await this.options.storage.updateTask({ ...task, status: 'escalated', updatedAt: now });
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', sourceRun.companyId, {
        eventKind: 'review_escalated',
        reason: transition.reason,
        taskId: task.id,
        artifactId: artifact.id,
        ceoQuestion: reviewReport.ceoQuestion,
      }, sourceRun.id, sourceRun.agentId));
    }
  }

  private async rejectInvalidRevision(
    sourceRun: Run,
    task: Task,
    artifact: Artifact,
    validation: Exclude<ReturnType<typeof validateRevisionSelfReport>, { valid: true }>,
  ) {
    const now = this.options.clock.now();
    await this.options.storage.updateTask({ ...task, status: 'escalated', updatedAt: now });
    await this.options.storage.updateArtifact({ ...artifact, status: 'rejected', updatedAt: now });

    for (const reason of validation.failureReasons) {
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', artifact.companyId, {
        eventKind: reason === 'missing_must_address' ? 'silent_must_address_skip' : 'unjustified_skip',
        taskId: task.id,
        artifactId: artifact.id,
        missingFindingIds: validation.missingFindingIds,
        unreasonedFindingIds: validation.unreasonedFindingIds ?? [],
      }, sourceRun.id, sourceRun.agentId));
    }
  }

  private async queueRevisionRun(sourceRun: Run, task: Task, artifact: Artifact, reviewReport: ReviewReport) {
    if (!task.assignedAgentId) {
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', task.companyId, {
        eventKind: 'revision_worker_missing',
        taskId: task.id,
        artifactId: artifact.id,
      }));
      return;
    }

    const worker = (await this.options.storage.listAgents(task.companyId)).find((agent) => agent.id === task.assignedAgentId);

    if (!worker) {
      await this.options.storage.appendRunEvent(this.event('agent_event_emitted', task.companyId, {
        eventKind: 'revision_worker_missing',
        taskId: task.id,
        artifactId: artifact.id,
      }));
      return;
    }

    const message: Message = {
      id: this.options.ids.next('message'),
      companyId: task.companyId,
      agentId: worker.id,
      fromAgentId: sourceRun.agentId,
      toAgentId: worker.id,
      runId: sourceRun.id,
      taskId: task.id,
      artifactId: artifact.id,
      author: 'system',
      kind: 'follow_up',
      content: [
        `Revision required for artifact ${artifact.id}.`,
        '',
        `Task: ${task.id}`,
        'Must-address findings:',
        ...reviewReport.findings
          .filter((finding) => finding.mustAddress)
          .map((finding) => `- ${finding.id}: ${finding.description}`),
        '',
        'Your revision response must include a self-report for every must-address finding.',
      ].join('\n'),
      createdAt: this.options.clock.now(),
    };

    await this.handleMessage(message, worker);
  }

  private async findOrCreateDelegatedAgent(companyId: string, delegation: AgentDelegationRequest, now: string, sourceRun: Run) {
    const existingAgent = (await this.options.storage.listAgents(companyId)).find((agent) => agent.name === delegation.agentName);

    if (existingAgent) {
      return existingAgent;
    }

    const agent: Agent = {
      id: this.options.ids.next('agent'),
      companyId,
      name: delegation.agentName,
      role: normalizeRole(delegation.role),
      lifecycle: normalizeLifecycle(delegation.lifecycle),
      capabilities: delegation.capabilities ?? ['chat', 'report'],
      sandboxProfile: delegation.sandboxProfile ?? 'podman-default',
      createdAt: now,
      updatedAt: now,
    };

    await this.options.storage.createAgent(agent);
    await this.options.storage.appendRunEvent(this.event('agent_created', companyId, {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      delegatedByRunId: sourceRun.id,
    }, sourceRun.id, sourceRun.agentId));

    return agent;
  }

  private event(type: RunEvent['type'], companyId: string, payload: Record<string, unknown>, runId?: string, agentId?: string): RunEvent {
    return {
      id: this.options.ids.next('event'),
      companyId,
      runId,
      agentId,
      type,
      payload,
      createdAt: this.options.clock.now(),
    };
  }

  private reviewReportDocument(sourceRun: Run, reviewReport: ReviewReport): ReportDocument {
    return {
      id: this.options.ids.next('report'),
      companyId: sourceRun.companyId,
      title: `Review report for ${reviewReport.artifactId}`,
      reportType: 'review_report',
      scope: {
        type: 'task',
        id: reviewReport.taskId,
      },
      attention: reviewReport.verdict === 'accepted' ? 'completed' : 'notice',
      timeRange: {
        from: sourceRun.startedAt ?? sourceRun.queuedAt,
        to: this.options.clock.now(),
      },
      headline: `Reviewer verdict: ${reviewReport.verdict}`,
      metrics: [
        {
          label: 'confidence',
          value: String(reviewReport.confidence),
        },
      ],
      sections: reviewReport.findings.map((finding) => ({
        title: `${finding.severity}: ${finding.id}`,
        body: finding.description,
        items: finding.suggestedFix ? [finding.suggestedFix] : undefined,
      })),
      tables: [
        {
          title: 'Acceptance criteria',
          columns: ['Criterion', 'Met', 'Evidence'],
          rows: reviewReport.acceptanceCriteriaCheck.map((check) => [
            check.criterion,
            check.met ? 'yes' : 'no',
            check.evidence,
          ]),
        },
      ],
      linkedTasks: [reviewReport.taskId],
      linkedArtifacts: [reviewReport.artifactId],
      linkedRuns: [sourceRun.id],
      linkedEvents: [],
      recommendedActions: reviewReport.ceoQuestion ? [reviewReport.ceoQuestion] : [],
      createdAt: this.options.clock.now(),
    };
  }
}

function normalizeRole(role?: AgentRole) {
  return role ?? 'worker';
}

function normalizeLifecycle(lifecycle?: AgentLifecycle) {
  return lifecycle ?? 'on_demand';
}

function markTaskInReview(task: Task, artifactId: string, updatedAt: string): Task {
  return {
    ...task,
    status: 'in_review',
    outputArtifactIds: task.outputArtifactIds.includes(artifactId)
      ? task.outputArtifactIds
      : [...task.outputArtifactIds, artifactId],
    updatedAt,
  };
}
