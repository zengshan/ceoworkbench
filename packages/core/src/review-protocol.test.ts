import { describe, expect, it } from 'vitest';
import {
  decideReviewTransition,
  pickReviewer,
  validateRevisionSelfReport,
  type ReviewCandidate,
  type ReviewFinding,
  type ReviewReport,
} from './review-protocol';

const baseCandidate = {
  companyId: 'company-1',
  lifecycle: 'on_demand',
  sandboxProfile: 'podman-default',
  createdAt: '2026-04-27T00:00:00.000Z',
  updatedAt: '2026-04-27T00:00:00.000Z',
} as const;

function reviewer(input: Partial<ReviewCandidate> & Pick<ReviewCandidate, 'id' | 'name' | 'reviews'>): ReviewCandidate {
  return {
    ...baseCandidate,
    role: 'reviewer',
    capabilities: ['review'],
    reviewPriority: 50,
    activeReviewCount: 0,
    available: true,
    ...input,
  };
}

function report(input: Partial<ReviewReport> & Pick<ReviewReport, 'verdict' | 'confidence'>): ReviewReport {
  return {
    artifactId: 'artifact-1',
    taskId: 'task-1',
    findings: [],
    acceptanceCriteriaCheck: [],
    scopeDriftDetected: false,
    needsCeoInput: false,
    ...input,
  };
}

function finding(input: Partial<ReviewFinding> & Pick<ReviewFinding, 'id' | 'severity'>): ReviewFinding {
  return {
    location: 'artifact.md',
    description: 'Finding description',
    mustAddress: input.severity === 'blocker' || input.severity === 'major',
    ...input,
  };
}

describe('review protocol', () => {
  it('selects an available reviewer by kind using priority and load before stable hash', () => {
    const result = pickReviewer({
      artifactId: 'artifact-1',
      artifactKind: 'chapter_draft',
      candidates: [
        reviewer({ id: 'agent-slow', name: 'slow', reviews: ['chapter_draft'], reviewPriority: 20, activeReviewCount: 0 }),
        reviewer({ id: 'agent-busy', name: 'busy', reviews: ['chapter_draft'], reviewPriority: 90, activeReviewCount: 3 }),
        reviewer({ id: 'agent-fast', name: 'fast', reviews: ['chapter_draft'], reviewPriority: 90, activeReviewCount: 1 }),
        reviewer({ id: 'agent-code', name: 'code', reviews: ['code_patch'], reviewPriority: 100, activeReviewCount: 0 }),
      ],
    });

    expect(result).toEqual({ type: 'assigned', reviewerId: 'agent-fast', reviewerChanged: false });
  });

  it('uses stable hash instead of input order when priority and load are tied', () => {
    const candidates = [
      reviewer({ id: 'agent-alpha', name: 'alpha', reviews: ['research_report'], reviewPriority: 90 }),
      reviewer({ id: 'agent-beta', name: 'beta', reviews: ['research_report'], reviewPriority: 90 }),
      reviewer({ id: 'agent-gamma', name: 'gamma', reviews: ['research_report'], reviewPriority: 90 }),
    ];
    const input = { artifactId: 'b', artifactKind: 'research_report' };

    const result = pickReviewer({ ...input, candidates });
    const reversedResult = pickReviewer({ ...input, candidates: [...candidates].reverse() });

    expect(result).toEqual({ type: 'assigned', reviewerId: 'agent-alpha', reviewerChanged: false });
    expect(reversedResult).toEqual(result);
  });

  it('keeps revision review assigned to the previous reviewer when still available', () => {
    expect(pickReviewer({
      artifactId: 'artifact-2',
      artifactKind: 'design_spec',
      previousReviewerId: 'agent-original',
      revisionCount: 1,
      candidates: [
        reviewer({ id: 'agent-fresh', name: 'fresh', reviews: ['design_spec'], reviewPriority: 100 }),
        reviewer({ id: 'agent-original', name: 'original', reviews: ['design_spec'], reviewPriority: 10, activeReviewCount: 4 }),
      ],
    })).toEqual({ type: 'assigned', reviewerId: 'agent-original', reviewerChanged: false });
  });

  it('marks revision reviewer changes when the previous reviewer is unavailable', () => {
    expect(pickReviewer({
      artifactId: 'artifact-2',
      artifactKind: 'design_spec',
      previousReviewerId: 'agent-original',
      revisionCount: 2,
      candidates: [
        reviewer({ id: 'agent-replacement', name: 'replacement', reviews: ['design_spec'], reviewPriority: 80 }),
        reviewer({ id: 'agent-original', name: 'original', reviews: ['design_spec'], reviewPriority: 100, available: false }),
      ],
    })).toEqual({ type: 'assigned', reviewerId: 'agent-replacement', reviewerChanged: true });
  });

  it('reports reviewer unavailable when no available reviewer supports the artifact kind', () => {
    expect(pickReviewer({
      artifactId: 'artifact-3',
      artifactKind: 'fact_summary',
      candidates: [
        reviewer({ id: 'agent-code', name: 'code', reviews: ['code_patch'] }),
        reviewer({ id: 'agent-fact', name: 'fact', reviews: ['fact_summary'], available: false }),
      ],
    })).toEqual({ type: 'unavailable', artifactKind: 'fact_summary' });
  });

  it('covers the verdict and confidence matrix used by supervisor state transitions', () => {
    expect(decideReviewTransition(report({ verdict: 'accepted', confidence: 0.85 }))).toEqual({ type: 'complete' });
    expect(decideReviewTransition(report({ verdict: 'accepted', confidence: 0.65 }))).toEqual({
      type: 'second_opinion',
      reason: 'accepted_below_confidence_threshold',
    });
    expect(decideReviewTransition(report({ verdict: 'needs_revision', confidence: 0.75 }))).toEqual({ type: 'revise' });
    expect(decideReviewTransition(report({ verdict: 'needs_revision', confidence: 0.55 }))).toEqual({
      type: 'escalate',
      reason: 'low_confidence',
    });
    expect(decideReviewTransition(report({ verdict: 'rejected', confidence: 0.85 }))).toEqual({ type: 'block' });
    expect(decideReviewTransition(report({ verdict: 'rejected', confidence: 0.75 }))).toEqual({
      type: 'escalate',
      reason: 'rejected_below_confidence_threshold',
    });
    expect(decideReviewTransition(report({ verdict: 'escalate', confidence: 0.95, ceoQuestion: 'Choose scope.' }))).toEqual({
      type: 'escalate',
      reason: 'reviewer_requested',
    });
  });

  it('forces revision workers to account for every must-address finding', () => {
    const previousFindings = [
      finding({ id: 'F101', severity: 'blocker' }),
      finding({ id: 'F102', severity: 'major' }),
      finding({ id: 'F103', severity: 'minor', mustAddress: false }),
    ];

    expect(validateRevisionSelfReport({
      previousFindings,
      selfReport: {
        findingResponses: [
          { findingId: 'F101', status: 'addressed', note: 'Added the missing matrix cases.' },
          { findingId: 'F102', status: 'not_addressed', note: 'Blocked by missing product charter.' },
        ],
      },
    })).toEqual({ valid: true });

    expect(validateRevisionSelfReport({
      previousFindings,
      selfReport: {
        findingResponses: [
          { findingId: 'F102', status: 'addressed', note: 'Added reviewer-change handling.' },
        ],
      },
    })).toEqual({
      valid: false,
      failureReasons: ['missing_must_address'],
      missingFindingIds: ['F101'],
    });

    expect(validateRevisionSelfReport({
      previousFindings,
      selfReport: {
        findingResponses: [
          { findingId: 'F101', status: 'addressed', note: 'Added the missing matrix cases.' },
          { findingId: 'F102', status: 'not_addressed', note: ' ' },
        ],
      },
    })).toEqual({
      valid: false,
      failureReasons: ['unjustified_not_addressed'],
      missingFindingIds: [],
      unreasonedFindingIds: ['F102'],
    });
  });
});
