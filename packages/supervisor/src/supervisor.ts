import {
  getRunKindForMessage,
  getRunPriority,
  type Agent,
  type AgentLifecycle,
  type AgentRole,
  type Artifact,
  type Clock,
  type IdGenerator,
  type Message,
  type Run,
  type RunEvent,
} from '../../core/src';
import type { AgentAdapter } from '../../runtime/src';
import type { AgentDelegationRequest } from '../../runtime/src';
import { buildAgentContext } from '../../runtime/src';
import type { Storage } from '../../storage/src';

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
      kind: message.kind,
    }));

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
        await this.options.storage.createTask(task);
        await this.options.storage.appendRunEvent(this.event('task_created', task.companyId, {
          taskId: task.id,
          title: task.title,
        }, runningRun.id, runningRun.agentId));
      }

      for (const delegation of result.delegations ?? []) {
        await this.delegateTask(runningRun, delegation);
      }

      for (const artifact of result.artifacts ?? []) {
        await this.options.writeArtifact?.(artifact);
        await this.options.storage.createArtifact(artifact);
        await this.options.storage.appendRunEvent(this.event('artifact_created', artifact.companyId, {
          artifactId: artifact.id,
          path: artifact.path,
        }, runningRun.id, runningRun.agentId));
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
      return runningRun;
    }
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
}

function normalizeRole(role?: AgentRole) {
  return role ?? 'worker';
}

function normalizeLifecycle(lifecycle?: AgentLifecycle) {
  return lifecycle ?? 'on_demand';
}
