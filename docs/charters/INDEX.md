# CEO Workbench Charters

Current active charter: [CEO Workbench Runtime Charter v0.1](./ceo-workbench-runtime-charter-v0.1.md)

## Version History

| Version | Status | Effective date | Reason summary |
| --- | --- | --- | --- |
| v0.1 | Active | 2026-04-27 | Establishes runtime-first governance for supervisor-owned protocol decisions, isolated review contexts, structured review reports, mandatory revision self-reports, escalation policy, and operating metrics. |

## v0.2 Amendment Backlog

- Add metric ownership, measurement frequency, and protocol response when thresholds are violated, including `project.health_alert`.
- Move confidence-driven second opinion from out-of-scope wording into a positive protocol commitment.
- Add explicit malformed-output and timeout handling: protocol exceptions must emit events and must not silently fall back to LLM judgment.

## Versioning Rules

- Patch edits may clarify wording without changing protocol behavior.
- New versions are required for changes to role boundaries, decision allocation, review context shape, confidence thresholds, revision limits, escalation policy, or required metrics.
- The active charter in this index is the acceptance baseline for runtime and review workflow changes.
