export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT NOT NULL,
  workspace_path TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  sandbox_profile TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS agents_company_id_idx ON agents(company_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS messages_company_created_idx ON messages(company_id, created_at);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  trigger_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  attempt INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS runs_company_status_priority_idx ON runs(company_id, status, priority DESC, queued_at);
CREATE INDEX IF NOT EXISTS runs_lease_expires_idx ON runs(status, lease_expires_at);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS run_events_company_created_idx ON run_events(company_id, created_at);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL,
  expected_output TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  dependency_task_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  input_artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_artifact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  requires_review BOOLEAN NOT NULL,
  pending_review_findings JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS tasks_company_created_idx ON tasks(company_id, created_at);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  kind TEXT,
  status TEXT NOT NULL,
  revision_self_report JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS artifacts_company_created_idx ON artifacts(company_id, created_at);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  source_message_id TEXT REFERENCES messages(id) ON DELETE SET NULL,
  source_report_id TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS memory_entries_company_created_idx ON memory_entries(company_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL,
  scope JSONB NOT NULL,
  attention TEXT NOT NULL,
  time_range JSONB NOT NULL,
  headline TEXT NOT NULL,
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  tables JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_runs JSONB NOT NULL DEFAULT '[]'::jsonb,
  linked_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS reports_company_created_idx ON reports(company_id, created_at);

CREATE TABLE IF NOT EXISTS decision_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_option_id TEXT,
  impact TEXT NOT NULL,
  deadline_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS decision_requests_company_created_idx ON decision_requests(company_id, created_at);

CREATE TABLE IF NOT EXISTS runtime_incidents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  classification TEXT NOT NULL,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  source_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS runtime_incidents_company_status_idx ON runtime_incidents(company_id, status, created_at);

CREATE TABLE IF NOT EXISTS runtime_incident_events (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  incident_id TEXT NOT NULL REFERENCES runtime_incidents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS runtime_incident_events_company_created_idx ON runtime_incident_events(company_id, created_at);

CREATE TABLE IF NOT EXISTS supervisor_heartbeats (
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  lease_owner TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (company_id, lease_owner)
);

CREATE INDEX IF NOT EXISTS supervisor_heartbeats_company_checked_in_idx ON supervisor_heartbeats(company_id, checked_in_at);

ALTER TABLE messages ADD COLUMN IF NOT EXISTS from_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS to_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS run_id TEXT REFERENCES runs(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS artifact_id TEXT REFERENCES artifacts(id) ON DELETE SET NULL;
`;
