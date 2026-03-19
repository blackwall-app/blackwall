import type { IssueStatus } from "@blackwall/database/schema";

export const ORDER_GAP = 65536;

type BoardOrderIssue = {
  key: string;
};

type BuildMoveIssueRequestInput = {
  issueKey: string;
  status: IssueStatus;
  targetIndex: number;
  issuesInTargetColumn: BoardOrderIssue[];
};

export function buildColumnOrder(input: {
  issueKey: string;
  targetIndex: number;
  issuesInTargetColumn: BoardOrderIssue[];
}) {
  const issueKeys = input.issuesInTargetColumn
    .filter((issue) => issue.key !== input.issueKey)
    .map((issue) => issue.key);

  const boundedIndex = Math.max(0, Math.min(input.targetIndex, issueKeys.length));
  issueKeys.splice(boundedIndex, 0, input.issueKey);

  return issueKeys;
}

export function buildMoveIssueRequest(input: BuildMoveIssueRequestInput) {
  const optimisticIssueKeys = buildColumnOrder(input);
  const movedIndex = optimisticIssueKeys.indexOf(input.issueKey);

  return {
    issueKey: input.issueKey,
    status: input.status,
    previousIssueKey: movedIndex > 0 ? optimisticIssueKeys[movedIndex - 1] : null,
    nextIssueKey:
      movedIndex >= 0 && movedIndex < optimisticIssueKeys.length - 1
        ? optimisticIssueKeys[movedIndex + 1]
        : null,
    optimisticIssueKeys,
  };
}
