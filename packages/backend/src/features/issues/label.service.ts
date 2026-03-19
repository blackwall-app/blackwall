import { createColorFromString } from "@blackwall/shared";
import { labelData } from "./label.data";

/**
 * Create a new label in a workspace. Generates color from label name.
 * @param input label name and workspace id
 * @returns created label
 * @throws Error if label with this name already exists
 */
async function createLabel(input: { name: string; workspaceId: string }) {
  const existingLabel = await labelData.getLabelByName({
    name: input.name,
    workspaceId: input.workspaceId,
  });

  if (existingLabel) {
    throw new Error("Label with this name already exists");
  }

  const colorKey = createColorFromString(input.name);
  return labelData.createLabel({
    name: input.name,
    colorKey,
    workspaceId: input.workspaceId,
  });
}

/**
 * Get a label by its id.
 * @param input label id and workspace id
 * @returns label data or null
 */
async function getLabelById(input: { labelId: string; workspaceId: string }) {
  return labelData.getLabelById(input);
}

/**
 * Get all labels in a workspace.
 * @param input workspace id
 * @returns list of labels
 */
async function getLabelsForWorkspace(input: { workspaceId: string }) {
  return labelData.getLabelsForWorkspace(input);
}

/**
 * Delete a label from a workspace.
 * @param input label id and workspace id
 * @throws Error if label not found
 */
async function deleteLabel(input: { labelId: string; workspaceId: string }) {
  const label = await labelData.getLabelById(input);
  if (!label) {
    throw new Error("Label not found");
  }

  return labelData.deleteLabel(input);
}

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
  createLabel,
  getLabelById,
  getLabelsForWorkspace,
  deleteLabel,
  addLabelToIssue,
  removeLabelFromIssue,
};
