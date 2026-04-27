import type {
  Agent,
  EntityId,
  ReviewFinding,
  ReviewFindingSeverity,
  RevisionFindingResponse,
  RevisionSelfReport,
} from './types';

export type ArtifactKind = string;

export type ReviewCandidate = Agent & {
  reviews: ArtifactKind[];
  reviewPriority?: number;
  activeReviewCount?: number;
  available?: boolean;
};

export type PickReviewerInput = {
  artifactId: EntityId;
  artifactKind: ArtifactKind;
  candidates: ReviewCandidate[];
  revisionCount?: number;
  previousReviewerId?: EntityId;
};

export type PickReviewerResult =
  | {
      type: 'assigned';
      reviewerId: EntityId;
      reviewerChanged: boolean;
    }
  | {
      type: 'unavailable';
      artifactKind: ArtifactKind;
    };

export type ReviewVerdict = 'accepted' | 'needs_revision' | 'rejected' | 'escalate';
export type AcceptanceCriterionCheck = {
  criterion: string;
  met: boolean;
  evidence: string;
};

export type ReviewReport = {
  artifactId: EntityId;
  taskId: EntityId;
  verdict: ReviewVerdict;
  confidence: number;
  findings: ReviewFinding[];
  acceptanceCriteriaCheck: AcceptanceCriterionCheck[];
  scopeDriftDetected: boolean;
  needsCeoInput: boolean;
  ceoQuestion?: string;
};

export type ReviewTransition =
  | { type: 'complete' }
  | { type: 'revise' }
  | { type: 'block' }
  | { type: 'second_opinion'; reason: 'accepted_below_confidence_threshold' }
  | { type: 'escalate'; reason: 'low_confidence' | 'rejected_below_confidence_threshold' | 'reviewer_requested' };

export type RevisionSelfReportValidation =
  | { valid: true }
  | {
      valid: false;
      failureReasons: Array<'missing_must_address' | 'unjustified_not_addressed'>;
      missingFindingIds: string[];
      unreasonedFindingIds?: string[];
    };

export function pickReviewer(input: PickReviewerInput): PickReviewerResult {
  const matches = input.candidates.filter((candidate) => (
    candidate.available !== false && candidate.reviews.includes(input.artifactKind)
  ));

  if (!matches.length) {
    return {
      type: 'unavailable',
      artifactKind: input.artifactKind,
    };
  }

  if (input.revisionCount && input.revisionCount > 0 && input.previousReviewerId) {
    const previousReviewer = matches.find((candidate) => candidate.id === input.previousReviewerId);

    if (previousReviewer) {
      return {
        type: 'assigned',
        reviewerId: previousReviewer.id,
        reviewerChanged: false,
      };
    }
  }

  const selected = [...matches]
    .sort((first, second) => compareReviewCandidates(first, second, input.artifactId))[0];

  return {
    type: 'assigned',
    reviewerId: selected.id,
    reviewerChanged: Boolean(input.revisionCount && input.revisionCount > 0 && input.previousReviewerId),
  };
}

export function decideReviewTransition(report: ReviewReport): ReviewTransition {
  if (report.verdict === 'escalate' || report.needsCeoInput || report.scopeDriftDetected) {
    return {
      type: 'escalate',
      reason: 'reviewer_requested',
    };
  }

  if (report.confidence < 0.6) {
    return {
      type: 'escalate',
      reason: 'low_confidence',
    };
  }

  if (report.verdict === 'accepted') {
    if (report.confidence < 0.7) {
      return {
        type: 'second_opinion',
        reason: 'accepted_below_confidence_threshold',
      };
    }

    return { type: 'complete' };
  }

  if (report.verdict === 'needs_revision') {
    return { type: 'revise' };
  }

  if (report.confidence < 0.8) {
    return {
      type: 'escalate',
      reason: 'rejected_below_confidence_threshold',
    };
  }

  return { type: 'block' };
}

export function validateRevisionSelfReport(input: {
  previousFindings: ReviewFinding[];
  selfReport: RevisionSelfReport;
}): RevisionSelfReportValidation {
  const responsesByFindingId = new Map(
    input.selfReport.findingResponses.map((response) => [response.findingId, response]),
  );
  const missingFindingIds = input.previousFindings
    .filter((finding) => finding.mustAddress)
    .filter((finding) => !responsesByFindingId.has(finding.id))
    .map((finding) => finding.id);
  const unreasonedFindingIds = input.previousFindings
    .filter((finding) => finding.mustAddress)
    .map((finding) => responsesByFindingId.get(finding.id))
    .filter((response): response is RevisionFindingResponse => Boolean(response))
    .filter((response) => response.status === 'not_addressed' && !response.note.trim())
    .map((response) => response.findingId);

  if (missingFindingIds.length || unreasonedFindingIds.length) {
    return {
      valid: false,
      failureReasons: [
        ...(missingFindingIds.length ? ['missing_must_address' as const] : []),
        ...(unreasonedFindingIds.length ? ['unjustified_not_addressed' as const] : []),
      ],
      missingFindingIds,
      ...(unreasonedFindingIds.length ? { unreasonedFindingIds } : {}),
    };
  }

  return { valid: true };
}

function compareReviewCandidates(first: ReviewCandidate, second: ReviewCandidate, artifactId: EntityId) {
  const priorityDifference = (second.reviewPriority ?? 0) - (first.reviewPriority ?? 0);

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const loadDifference = (first.activeReviewCount ?? 0) - (second.activeReviewCount ?? 0);

  if (loadDifference !== 0) {
    return loadDifference;
  }

  const firstHash = stableHash(`${artifactId}:${first.id}`);
  const secondHash = stableHash(`${artifactId}:${second.id}`);

  if (firstHash !== secondHash) {
    return firstHash - secondHash;
  }

  return first.id.localeCompare(second.id);
}

function stableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
