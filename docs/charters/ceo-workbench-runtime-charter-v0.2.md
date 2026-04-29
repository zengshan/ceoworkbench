# CEO Workbench Runtime Charter v0.2

Status: Active
Effective date: 2026-04-29
Supersedes: [CEO Workbench Runtime Charter v0.1](./ceo-workbench-runtime-charter-v0.1.md)

## 1. Purpose

CEO Workbench exists to run a multi-agent company workflow with minimal CEO intervention. Its runtime must move normal work forward through deterministic protocol rules, not through ad hoc manager judgment or manual copy-paste.

This version preserves the v0.1 review protocol commitments and adds runtime health as a first-class protocol concern. A system that cannot reach its LLM or whose supervisor is not alive cannot report trustworthy protocol outcomes.

## 2. Non-Negotiable Runtime Principles

- LLM agents write content, perform task work, and produce structured review reports.
- Supervisor code owns protocol decisions: routing, state transitions, retry limits, confidence thresholds, runtime health classification, liveness checks, and normal verdict handling.
- Manager agents handle business exceptions, not normal verdicts or infrastructure failures.
- CEO input is reserved for true escalations: unresolved conflict, scope drift, budget failure, deadline failure, protocol gaps, or infrastructure incidents that require external intervention.
- Review context is isolated and allowlisted. Reviewer agents do not receive worker process messages, worker identity, run IDs, global chat history, or unapproved debug fields.
- Worker self-reports are mandatory for revisions. Skipping `mustAddress` findings without explicit justification triggers rejection, not another revision.
- Runtime incidents are independent source-of-truth objects. They must not be mixed into normal run events, review events, or business escalation queues.

## 3. Runtime Health Protocol Amendment

Runtime health is measured before protocol outcomes are trusted. A green review dashboard is not meaningful if the supervisor is stalled or LLM calls cannot execute.

### Incident Classification

Runtime failures use a deterministic two-class model based on recoverability, not subjective severity:

- `transient`: expected to recover through waiting and retrying, such as 429 rate limits, temporary 5xx responses, network timeouts, or short-lived upstream failures.
- `persistent`: requires external intervention before work should continue, such as 401 invalid credentials, 402 billing or spending limits, 403 permission errors, configuration errors, or transient failures that exceed the escalation threshold.

The supervisor must not ask an LLM to classify runtime failures.

### Transient Escalation Threshold

Transient failures escalate to `persistent` when all of the following are true:

- Time window: 10 minutes.
- Threshold: 8 transient `run_failed` events.
- Reset rule: any successful `run_completed` event inside the window resets the transient failure count for escalation purposes.

These numbers are charter policy. Implementations may expose them as configuration only if the configured values are derived from this charter or a later amendment.

### Incident Storage

Runtime incidents are independent first-class objects with their own storage and lifecycle:

- Required fields: `id`, `companyId`, `kind`, `classification`, `status`, `title`, `summary`, `createdAt`, `updatedAt`, and optional source/error fields.
- Incident events are stored separately from run events and include at minimum `incident_created` and `incident_resolved`.
- Active incidents must appear in CEO briefing under an infrastructure/runtime section, separate from business escalations and CEO decisions.
- Resolved incidents remain visible in CEO briefing for at least 24 hours so the CEO can see that recovery happened.

### Work Fail-Fast Rule

When an active `persistent` runtime incident exists, `work` and equivalent run-starting commands must refuse to start new runs. The command must tell the operator to inspect incidents instead of creating more failing runs.

### Liveness Heartbeat

The supervisor must write a heartbeat for each company it checks. A heartbeat is stale after 5 minutes without check-in.

If the latest heartbeat is stale, `doctor` or an equivalent runtime health check must create a `supervisor.liveness_lost` persistent incident. This is a highest-priority runtime issue because all other protocol signals depend on supervisor liveness.

## 4. Business Protocol Commitments

v0.1 Sections 3-5 remain binding: role boundaries, deterministic decision allocation, review routing, isolated review context, structured review reports, revision self-reporting, confidence thresholds, and revision limits are unchanged unless a later amendment replaces them.

## 5. Metrics

Runtime health includes both infrastructure liveness and protocol outcomes.

Required infrastructure indicators:

- Active persistent runtime incidents must be visible to CEO briefing and status reports.
- Last supervisor heartbeat must be available to runtime health checks.
- Stale heartbeat threshold is 5 minutes.
- Recently resolved runtime incidents remain visible for at least 24 hours.

Required protocol outcome thresholds from v0.1 remain in force:

- `escalation_rate < 5%` sustained over 7 days is healthy.
- `escalation_rate >= 5% and <= 15%` sustained over 7 days requires monitoring.
- `escalation_rate > 15%` sustained over 7 days means the protocol or agent capabilities have a gap.
- `revision_count_avg < 1.5` per completed reviewed task.
- `revision_count_p95 <= 3` per completed reviewed task.
- `reviewer_unavailable_rate = 0%` for registered production artifact kinds.
- `silent_must_address_skip_count = 0` for all revision runs.

## 6. CEO Briefing Separation

CEO briefing must separate:

- Active runtime incidents: infrastructure failures and liveness failures requiring operator action.
- Recently resolved runtime incidents: infrastructure failures resolved in the last 24 hours.
- Pending business escalations: content, review, scope, or decision issues requiring CEO judgment.

These categories must not be merged into a single generic action list.

## 7. Acknowledged Debt

The v0.1 acknowledged debt remains open unless separately remediated. Additional v0.2 debt:

| Debt | Remediation plan | Target |
| --- | --- | --- |
| Runtime health thresholds are currently charter constants. | Add runtime configuration that can only override thresholds by referencing an active charter version. | Before multi-company hosted operation. |
| Incident metrics are visible in CLI but not yet in the browser workbench. | Add active/recent incident panels to the CEO dashboard. | Before long unattended browser-first runs. |

## 8. Amendment Rules

Any amendment that changes role boundaries, decision allocation, review context shape, confidence thresholds, revision limits, runtime incident classification, transient escalation thresholds, liveness thresholds, or required metrics must create a new charter version and update `docs/charters/INDEX.md`.
