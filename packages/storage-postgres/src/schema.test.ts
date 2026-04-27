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
});
