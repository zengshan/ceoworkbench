import { describe, expect, it } from 'vitest';
import { INITIAL_SCHEMA_SQL } from './schema';

describe('Postgres schema', () => {
  it('creates all runtime source-of-truth tables', () => {
    for (const table of [
      'companies',
      'agents',
      'messages',
      'runs',
      'run_events',
      'tasks',
      'artifacts',
      'memory_entries',
      'reports',
      'decision_requests',
    ]) {
      expect(INITIAL_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('defines lease-oriented run indexes and JSONB projection fields', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('runs_company_status_priority_idx');
    expect(INITIAL_SCHEMA_SQL).toContain('runs_lease_expires_idx');
    expect(INITIAL_SCHEMA_SQL).toContain('payload JSONB');
    expect(INITIAL_SCHEMA_SQL).toContain('metrics JSONB');
  });

  it('persists review protocol state on tasks and artifacts', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('pending_review_findings JSONB');
    expect(INITIAL_SCHEMA_SQL).toContain('kind TEXT');
    expect(INITIAL_SCHEMA_SQL).toContain('revision_self_report JSONB');
  });

  it('keeps message-bus correlation hooks on messages', () => {
    expect(INITIAL_SCHEMA_SQL).toContain('from_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL');
    expect(INITIAL_SCHEMA_SQL).toContain('to_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL');
    expect(INITIAL_SCHEMA_SQL).toContain('run_id TEXT REFERENCES runs(id) ON DELETE SET NULL');
    expect(INITIAL_SCHEMA_SQL).toContain('task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL');
    expect(INITIAL_SCHEMA_SQL).toContain('artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL');
  });
});
