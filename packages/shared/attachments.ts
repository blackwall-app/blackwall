import { Schema } from "effect";
import { Multipart } from "effect/unstable/http";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { IssueNotFound, IssueParamsSchema } from "./issues";
import { IssueAttachment } from "./models";

export class AttachmentNotFound extends ApiError<AttachmentNotFound>()("AttachmentNotFound", {
  code: ErrorCode.ATTACHMENT_NOT_FOUND,
  status: 404,
  message: "Attachment not found",
}) {}

export class AttachmentFileNotFound extends ApiError<AttachmentFileNotFound>()(
  "AttachmentFileNotFound",
  {
    code: ErrorCode.ATTACHMENT_FILE_NOT_FOUND,
    status: 404,
    message: "Attachment file not found",
  },
) {}

export class AttachmentFileInvalid extends ApiError<AttachmentFileInvalid>()(
  "AttachmentFileInvalid",
  {
    code: ErrorCode.FILE_MISSING_OR_INVALID,
    status: 400,
    message: "File is missing or invalid",
  },
) {}

/** A multipart form with the file in `file`. The client sends a `FormData`. */
export const AttachmentUploadSchema = Schema.Struct({
  file: Multipart.SingleFileSchema,
}).pipe(HttpApiSchema.asMultipartStream());

export const AttachmentResponse = Schema.Struct({
  attachment: IssueAttachment,
});

export const AssociateAttachmentsSchema = Schema.Struct({
  attachmentIds: Schema.Array(Schema.String),
});

export const AttachmentParamsSchema = Schema.Struct({
  issueKey: Schema.String,
  attachmentId: Schema.String,
});

export const AttachmentIdParamsSchema = Schema.Struct({
  attachmentId: Schema.String,
});

/**
 * Issue attachments. Every endpoint but `download` is workspace-scoped.
 * `download` is loaded by `<img>` tags in issue descriptions, which send the
 * session cookie but no workspace header, so it checks access per attachment.
 */
export class AttachmentsApi extends HttpApiGroup.make("attachments")
  .add(
    HttpApiEndpoint.post("upload", "/:issueKey/attachments", {
      params: IssueParamsSchema,
      payload: AttachmentUploadSchema,
      success: AttachmentResponse,
      error: [IssueNotFound, AttachmentFileInvalid],
    })
      .middleware(WorkspaceMembership)
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.post("uploadOrphan", "/attachments", {
      payload: AttachmentUploadSchema,
      success: AttachmentResponse,
      error: AttachmentFileInvalid,
    })
      .middleware(WorkspaceMembership)
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.post("associate", "/:issueKey/attachments/associate", {
      params: IssueParamsSchema,
      payload: AssociateAttachmentsSchema,
      success: Schema.Struct({ success: Schema.Boolean }),
      error: IssueNotFound,
    })
      .middleware(WorkspaceMembership)
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.get("get", "/:issueKey/attachments/:attachmentId", {
      params: AttachmentParamsSchema,
      success: AttachmentResponse,
      error: [IssueNotFound, AttachmentNotFound],
    })
      .middleware(WorkspaceMembership)
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.delete("delete", "/:issueKey/attachments/:attachmentId", {
      params: AttachmentParamsSchema,
      success: Schema.Struct({ message: Schema.String }),
      error: [IssueNotFound, AttachmentNotFound],
    })
      .middleware(WorkspaceMembership)
      .middleware(Authorization),
  )
  .add(
    HttpApiEndpoint.get("download", "/attachments/:attachmentId/download", {
      params: AttachmentIdParamsSchema,
      success: HttpApiSchema.StreamUint8Array(),
      error: [AttachmentNotFound, AttachmentFileNotFound],
    }).middleware(Authorization),
  )
  .prefix("/issues") {}
