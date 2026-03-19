import { HTTPException } from "hono/http-exception";
import { issueData } from "./issue.data";
import { attachmentData } from "./attachment.data";
import { saveFile } from "../../lib/file-upload";

/**
 * Get an issue by its key or throw a 404 error.
 * @param workspaceId workspace id
 * @param issueKey issue key
 * @returns issue data
 * @throws HTTPException 404 if issue not found
 */
async function getIssueOrThrow(workspaceId: string, issueKey: string) {
  const issue = await issueData.getIssueByKey({ workspaceId, issueKey });
  if (!issue) {
    throw new HTTPException(404, { message: "Issue not found" });
  }
  return issue;
}

/**
 * Upload a file attachment, optionally associating it with an issue.
 * @param input workspace details, optional issue key, user id, and file
 * @returns created attachment
 */
export async function uploadAttachment(input: {
  workspaceSlug: string;
  workspaceId: string;
  issueKey: string | null;
  userId: string;
  file: File;
}) {
  const originalFileName = input.file.name;
  const originalFileNameWithoutExtension = originalFileName.split(".").slice(0, -1).join(".");

  const filePath = await saveFile(input.file, {
    directory: `workspaces/${input.workspaceSlug}/issue-attachments`,
    name: originalFileNameWithoutExtension,
  });

  if (input.issueKey) {
    const issue = await getIssueOrThrow(input.workspaceId, input.issueKey);

    return attachmentData.createAttachment({
      issue,
      userId: input.userId,
      filePath,
      mimeType: input.file.type,
      originalFileName,
    });
  }

  return attachmentData.createOrphanAttachment({
    userId: input.userId,
    filePath,
    mimeType: input.file.type,
    originalFileName,
  });
}

/**
 * Associate orphan attachments with an issue.
 * @param input workspace id, issue key, user id, and attachment ids
 */
export async function associateAttachments(input: {
  workspaceId: string;
  issueKey: string;
  userId: string;
  attachmentIds: string[];
}) {
  const issue = await getIssueOrThrow(input.workspaceId, input.issueKey);

  await attachmentData.associateAttachmentsWithIssue({
    userId: input.userId,
    issue,
    attachmentIds: input.attachmentIds,
  });
}

/**
 * Get an attachment by its id for a specific issue.
 * @param input workspace id, issue key, and attachment id
 * @returns attachment data
 * @throws HTTPException 404 if attachment not found
 */
export async function getAttachment(input: {
  workspaceId: string;
  issueKey: string;
  attachmentId: string;
}) {
  const issue = await getIssueOrThrow(input.workspaceId, input.issueKey);

  const attachment = await attachmentData.getAttachmentById({
    attachmentId: input.attachmentId,
    issueId: issue.id,
  });

  if (!attachment) {
    throw new HTTPException(404, { message: "Attachment not found" });
  }

  return attachment;
}

/**
 * Get an attachment for download. Validates user access.
 * @param input user id and attachment id
 * @returns attachment data for serving
 * @throws HTTPException 404 if attachment not found or access denied
 */
export async function getAttachmentForDownload(input: { userId: string; attachmentId: string }) {
  const attachment = await attachmentData.getAttachmentForServing({
    userId: input.userId,
    attachmentId: input.attachmentId,
  });

  if (!attachment) {
    throw new HTTPException(404, { message: "Attachment not found" });
  }

  return attachment;
}

/**
 * Delete an attachment from an issue.
 * @param input workspace id, issue key, attachment id, and user id
 * @throws HTTPException 404 if attachment not found
 */
export async function deleteAttachment(input: {
  workspaceId: string;
  issueKey: string;
  attachmentId: string;
  userId: string;
}) {
  const issue = await getIssueOrThrow(input.workspaceId, input.issueKey);

  const attachment = await attachmentData.getAttachmentById({
    attachmentId: input.attachmentId,
    issueId: issue.id,
  });

  if (!attachment) {
    throw new HTTPException(404, { message: "Attachment not found" });
  }

  await attachmentData.deleteAttachment({
    attachmentId: input.attachmentId,
    issue,
    actorId: input.userId,
  });
}

export const attachmentService = {
  uploadAttachment,
  associateAttachments,
  getAttachment,
  getAttachmentForDownload,
  deleteAttachment,
};
