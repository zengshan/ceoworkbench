import { describe, expect, it } from 'vitest';
import type { RuntimeIncident, Run } from '../../core/src';
import { MemoryStorage } from './memory-storage';

function run(overrides: Partial<Run>): Run {
  return {
    id: overrides.id ?? 'run-1',
    companyId: overrides.companyId ?? 'company-1',
    agentId: overrides.agentId ?? 'agent-1',
    kind: overrides.kind ?? 'continuation',
    status: overrides.status ?? 'queued',
    priority: overrides.priority ?? 10,
    attempt: overrides.attempt ?? 0,
    maxAttempts: overrides.maxAttempts ?? 3,
    queuedAt: overrides.queuedAt ?? '2026-04-25T00:00:00.000Z',
    ...overrides,
  };
}

describe('MemoryStorage', () => {
  it('leases the highest-priority queued run first', async () => {
    const storage = new MemoryStorage();
    await storage.enqueueRun(run({ id: 'low', priority: 10 }));
    await storage.enqueueRun(run({ id: 'high', priority: 100 }));

    const leasedRun = await storage.leaseNextRun({
      leaseOwner: 'worker-1',
      leaseExpiresAt: '2026-04-25T01:00:00.000Z',
    });

    expect(leasedRun?.id).toBe('high');
    expect(leasedRun?.status).toBe('leasing');
  });

  it('does not lease two runs for the same company at the same time', async () => {
    const storage = new MemoryStorage();
    await storage.enqueueRun(run({ id: 'first', companyId: 'company-1', priority: 100 }));
    await storage.enqueueRun(run({ id: 'second', companyId: 'company-1', priority: 90 }));

    await storage.leaseNextRun({
      leaseOwner: 'worker-1',
      leaseExpiresAt: '2026-04-25T01:00:00.000Z',
    });

    const secondLease = await storage.leaseNextRun({
      leaseOwner: 'worker-2',
      leaseExpiresAt: '2026-04-25T01:00:00.000Z',
    });

    expect(secondLease).toBeNull();
  });

  it('can lease runs from different companies concurrently', async () => {
    const storage = new MemoryStorage();
    await storage.enqueueRun(run({ id: 'first', companyId: 'company-1', priority: 100 }));
    await storage.enqueueRun(run({ id: 'second', companyId: 'company-2', priority: 90 }));

    const firstLease = await storage.leaseNextRun({
      leaseOwner: 'worker-1',
      leaseExpiresAt: '2026-04-25T01:00:00.000Z',
    });
    const secondLease = await storage.leaseNextRun({
      leaseOwner: 'worker-2',
      leaseExpiresAt: '2026-04-25T01:00:00.000Z',
    });

    expect(firstLease?.id).toBe('first');
    expect(secondLease?.id).toBe('second');
  });

  it('recovers expired leases for retry without losing auditability', async () => {
    const storage = new MemoryStorage();
    await storage.enqueueRun(run({
      id: 'expired',
      status: 'running',
      attempt: 0,
      leaseOwner: 'worker-1',
      leaseExpiresAt: '2026-04-25T00:30:00.000Z',
    }));

    const recovered = await storage.recoverExpiredRuns('2026-04-25T01:00:00.000Z');

    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      id: 'expired',
      status: 'retrying',
      attempt: 1,
      leaseOwner: undefined,
      leaseExpiresAt: undefined,
    });
  });

  it('stores runtime incidents separately from run events and resolves them', async () => {
    const storage = new MemoryStorage();
    const incident: RuntimeIncident = {
      id: 'incident-1',
      companyId: 'company-1',
      kind: 'llm.persistent_error',
      classification: 'persistent',
      status: 'active',
      title: 'AI service unavailable',
      summary: 'OpenAI Responses API failed with 402.',
      sourceRunId: 'run-1',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    };

    await storage.createIncident(incident);
    await storage.appendIncidentEvent({
      id: 'incident-event-1',
      companyId: 'company-1',
      incidentId: 'incident-1',
      type: 'incident_created',
      payload: { classification: 'persistent' },
      createdAt: '2026-04-25T00:00:00.000Z',
    });
    const resolved = await storage.resolveIncident('incident-1', '2026-04-25T00:05:00.000Z');
    await storage.appendIncidentEvent({
      id: 'incident-event-2',
      companyId: 'company-1',
      incidentId: 'incident-1',
      type: 'incident_resolved',
      payload: {},
      createdAt: '2026-04-25T00:05:00.000Z',
    });

    expect(resolved).toMatchObject({ id: 'incident-1', status: 'resolved', resolvedAt: '2026-04-25T00:05:00.000Z' });
    expect(await storage.listEvents('company-1')).toEqual([]);
    expect(await storage.listIncidents('company-1')).toHaveLength(1);
    expect((await storage.listIncidentEvents('company-1')).map((event) => event.type)).toEqual(['incident_created', 'incident_resolved']);
  });

  it('records the latest supervisor heartbeat by company and lease owner', async () => {
    const storage = new MemoryStorage();

    await storage.recordSupervisorHeartbeat({
      companyId: 'company-1',
      leaseOwner: 'cli-worker',
      checkedInAt: '2026-04-25T00:00:00.000Z',
    });
    await storage.recordSupervisorHeartbeat({
      companyId: 'company-1',
      leaseOwner: 'cli-worker',
      checkedInAt: '2026-04-25T00:01:00.000Z',
    });

    expect(await storage.listSupervisorHeartbeats('company-1')).toEqual([
      {
        companyId: 'company-1',
        leaseOwner: 'cli-worker',
        checkedInAt: '2026-04-25T00:01:00.000Z',
      },
    ]);
  });
});
