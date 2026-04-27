# CEO Workbench Runtime Charter v0.1

Status: Active
Effective date: 2026-04-27

## 1. Purpose

CEO Workbench exists to run a multi-agent company workflow with minimal CEO intervention. Its runtime must move normal work forward through deterministic protocol rules, not through ad hoc manager judgment or manual copy-paste.

This charter defines the operating contract for the runtime layer. It is the acceptance baseline for supervisor behavior, review routing, review context construction, escalation, and long-running quality controls.

## 2. Non-Negotiable Runtime Principles

- LLM agents write content, perform task work, and produce structured review reports.
- Supervisor code owns protocol decisions: routing, state transitions, retry limits, confidence thresholds, and normal verdict handling.
- Manager agents handle exceptions, not normal verdicts.
- CEO input is reserved for true escalations: unresolved conflict, scope drift, budget failure, deadline failure, or protocol gaps.
- Review context is isolated and allowlisted. Reviewer agents do not receive worker process messages, worker identity, run IDs, global chat history, or unapproved debug fields.
- Worker self-reports are mandatory for revisions. Skipping `mustAddress` findings without explicit justification triggers rejection, not another revision.

## 3. Role Boundaries

### CEO

The CEO sets direction and resolves escalations. The CEO does not inspect normal artifacts, shuttle outputs between agents, choose reviewers, or approve routine accepted verdicts.

### Supervisor

The supervisor is the deterministic runtime authority. It leases runs, routes work, builds review contexts, selects reviewers, interprets structured review reports, enforces revision limits, emits exception events, and updates task/artifact state.

The supervisor must not ask an LLM to decide reviewer selection, normal state transitions, confidence thresholds, or whether a routine accepted review should complete a task.

### Manager

The manager decomposes CEO intent and coordinates exceptions. It consumes exception events such as reviewer unavailable, reviewer conflict, scope drift, budget exceeded, revision limit exceeded, and deadline missed.

The manager does not consume normal accepted verdicts and does not act as a hidden reviewer.

### Worker

Workers execute assigned tasks and produce artifacts. On revision runs, workers must submit a self-report that accounts for every `mustAddress` finding from the prior review.

### Reviewer

Reviewers evaluate artifacts against the charter, task specification, artifact content, acceptance criteria, and structured prior findings. They produce structured review reports. They do not decide runtime state directly.

## 4. Decision Allocation

The runtime must keep workflow decisions out of LLM reasoning whenever the decision can be represented as protocol.

| Decision | Owner | Rule |
| --- | --- | --- |
| Generate task output | Worker LLM | Content generation is agent work. |
| Generate review report | Reviewer LLM | Judgment is expressed as structured data. |
| Select reviewer | Supervisor | Match `artifact.kind` to reviewer capabilities, then deterministic tie-breakers. |
| Build review context | Supervisor | Use a dedicated allowlisted `ReviewContext`. |
| Accept normal high-confidence artifact | Supervisor | Consume structured verdict and confidence. |
| Request revision | Supervisor | Consume structured verdict and enforce self-report contract. |
| Block rejected artifact | Supervisor | Only high-confidence rejection can block directly. |
| Ask for second opinion | Supervisor | Triggered by protocol thresholds. |
| Escalate to manager | Supervisor | Exception event, not normal flow. |
| Escalate to CEO | Supervisor or manager | Only for true decision points or protocol gaps. |

LLM output may inform protocol fields, but it must not replace the protocol switch/case that consumes those fields.

## 5. Protocol Commitments

### Review Routing

Artifacts must carry a semantic `kind`. Reviewer agents declare which artifact kinds they can review. Reviewer selection is deterministic:

1. Filter to available reviewers whose `reviews` includes `artifact.kind`.
2. If no reviewer matches, emit `reviewer.unavailable`.
3. If this is a revision and the previous reviewer is still available, keep the same reviewer.
4. Otherwise break ties by reviewer priority, active review load, and stable hash.
5. If a revision must change reviewers, emit `reviewer_changed`.

### Review Context

Review context must be built separately from normal agent context. It may include only:

- `charter`
- `task`
- `artifact`
- `acceptanceCriteria`
- `priorReview`

Prior review input must include structured findings only. It must not include the prior verdict or the reviewer overall opinion.

### Review Report

Review reports must use a structured schema with:

- `verdict: accepted | needs_revision | rejected | escalate`
- `confidence`
- `findings`
- `acceptanceCriteriaCheck`
- `scopeDriftDetected`
- `needsCeoInput`
- optional `ceoQuestion`

### Revision Contract

Every revision must include a worker self-report. Each prior `mustAddress` finding must be marked `addressed` or `not_addressed`. A `not_addressed` finding must include a non-empty justification.

If a worker silently skips a `mustAddress` finding, the next review must reject the revision rather than allow another ordinary revision loop.

### Confidence Thresholds

Default confidence behavior:

- `accepted` with confidence `>= 0.7`: complete.
- `accepted` with confidence `< 0.7`: request second opinion.
- any verdict with confidence `< 0.6`: escalate.
- `rejected` with confidence `>= 0.8`: block.
- `rejected` with confidence `< 0.8`: escalate.

### Revision Limits

Default `MAX_REVISIONS = 3`. Overrides require a charter amendment or a task/kind policy explicitly derived from a charter amendment.

## 6. Metrics

Runtime health is measured by protocol outcomes, not by subjective impressions.

Required thresholds:

- `escalation_rate < 5%` sustained over 7 days is healthy.
- `escalation_rate >= 5% and <= 15%` sustained over 7 days requires monitoring.
- `escalation_rate > 15%` sustained over 7 days means the protocol or agent capabilities have a gap.
- `revision_count_avg < 1.5` per completed reviewed task.
- `revision_count_p95 <= 3` per completed reviewed task.
- `reviewer_unavailable_rate = 0%` for registered production artifact kinds.
- `silent_must_address_skip_count = 0` for all revision runs.

Metrics must be visible to the CEO dashboard before the runtime is considered ready for long unattended runs.

## 7. Acknowledged Debt

These are known debts that must be remediated.

| Debt | Remediation plan | Target |
| --- | --- | --- |
| `ReviewContext` currently fetches tasks and artifacts through list operations. | Add `storage.getTask(id)` and `storage.getArtifact(id)` and update `buildReviewContext` to use point lookups. | Before 10,000-task scale testing. |
| Artifact content has no protocol size limit. | Add content byte limits, truncation metadata, and reviewer-safe artifact summaries. | Before large document artifacts become normal workflow inputs. |
| `priorReview` construction relies on optional field presence but still needs explicit zero-round semantics. | Replace truthy checks with explicit `undefined` checks and test `revisionRound: 0`. | Before supervisor integration. |
| Charter is not yet loaded by runtime configuration. | Add a runtime configuration path for the active charter and pass it into review context construction. | During supervisor review loop integration. |

## 8. Out of Scope (v0.1)

The following are intentionally excluded from v0.1:

- Product positioning, investor narrative, marketing claims, and landing-page copy.
- Multi-reviewer quorum for all artifacts. v0.1 allows second opinions only when protocol thresholds require it.
- Fine-grained reviewer reputation scoring.
- Automatic kind taxonomy generation by LLM.
- CEO approval for normal accepted artifacts.
- Manager review of routine worker output.

## 9. Amendment Rules

This charter can change, but protocol changes must be explicit.

Any amendment that changes role boundaries, decision allocation, review context shape, confidence thresholds, revision limits, or required metrics must create a new charter version and update `docs/charters/INDEX.md`.
