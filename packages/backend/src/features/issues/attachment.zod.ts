import { z } from "zod";

export const attachmentParamsSchema = z.object({
  issueKey: z.string(),
});

export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;

export const attachmentUploadFormSchema = z.object({
  file: z.any(),
});

export type AttachmentUploadForm = z.infer<typeof attachmentUploadFormSchema>;

export const associateAttachmentsSchema = z.object({
  attachmentIds: z.array(z.string()),
});

export type AssociateAttachments = z.infer<typeof associateAttachmentsSchema>;

export const deleteAttachmentParamsSchema = z.object({
  issueKey: z.string(),
  attachmentId: z.string(),
});

export type DeleteAttachmentParams = z.infer<typeof deleteAttachmentParamsSchema>;

export const getAttachmentParamsSchema = z.object({
  attachmentId: z.string(),
});

export type GetAttachmentParams = z.infer<typeof getAttachmentParamsSchema>;

export const attachmentSchema = z.object({
  id: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  size: z.number(),
  path: z.string(),
  issueId: z.string().nullable().optional(),
  uploaderId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.number().nullable().optional(),
});

export const attachmentResponseSchema = z.object({
  attachment: attachmentSchema,
});
