import { labelData } from "./label.data";

/**
 * Add a label to an issue.
 * @param input issue id, label id, workspace id, and actor id
 */
async function addLabelToIssue(input: {
  issueId: string;
  labelId: string;
  workspaceId: string;
  actorId: string;
}) {
  return labelData.addLabelToIssue(input);
}

/**
 * Remove a label from an issue.
 * @param input issue id, label id, workspace id, and actor id
 */
async function removeLabelFromIssue(input: {
  issueId: string;
  labelId: string;
  workspaceId: string;
  actorId: string;
}) {
  return labelData.removeLabelFromIssue(input);
}

export const labelService = {
  addLabelToIssue,
  removeLabelFromIssue,
};
