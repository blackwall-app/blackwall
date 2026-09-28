import { Api, AttachmentFileInvalid, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect, Stream } from "effect";
import { HttpServerResponse, type Multipart } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { type AttachmentUpload, AttachmentService } from "../features/issues/AttachmentService";

/** The first file sent as `file`. */
const readUploadForm = Effect.fnUntraced(
  function* (parts: Stream.Stream<Multipart.Part, Multipart.MultipartError>) {
    let file: AttachmentUpload | undefined;
    yield* Stream.runForEach(parts, (part) =>
      part._tag === "File" && part.key === "file" && file === undefined
        ? Effect.map(part.contentEffect, (bytes) => {
            file = { name: part.name, contentType: part.contentType, bytes };
          })
        : Effect.void,
    );
    if (file === undefined) {
      return yield* new AttachmentFileInvalid();
    }
    return file;
  },
  Effect.catchTag("MultipartError", () => Effect.fail(new AttachmentFileInvalid())),
);

/**
 * Types a browser renders without running scripts. Anything else, such as HTML
 * or SVG, downloads instead of rendering on the API's origin.
 */
const INLINE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

export const AttachmentsHandlers = HttpApiBuilder.group(
  Api,
  "attachments",
  Effect.fn(function* (handlers) {
    const attachments = yield* AttachmentService;

    return handlers.handleAll({
      upload: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const attachment = yield* attachments.uploadToIssue({
            workspaceSlug: workspace.slug,
            workspaceId: workspace.id,
            issueKey: params.issueKey,
            userId: user.id,
            file: yield* readUploadForm(payload),
          });
          return { attachment };
        }),
      uploadOrphan: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const attachment = yield* attachments.uploadOrphan({
            workspaceSlug: workspace.slug,
            userId: user.id,
            file: yield* readUploadForm(payload),
          });
          return { attachment };
        }),
      associate: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          yield* attachments.associate({
            workspaceId: workspace.id,
            issueKey: params.issueKey,
            userId: user.id,
            attachmentIds: payload.attachmentIds,
          });
          return { success: true };
        }),
      get: ({ params }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const attachment = yield* attachments.getAttachment({
            workspaceId: workspace.id,
            issueKey: params.issueKey,
            attachmentId: params.attachmentId,
          });
          return { attachment };
        }),
      delete: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          yield* attachments.deleteAttachment({
            workspaceId: workspace.id,
            issueKey: params.issueKey,
            attachmentId: params.attachmentId,
            userId: user.id,
          });
          return { message: "Attachment deleted" };
        }),
      download: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const { attachment, file } = yield* attachments.getDownload({
            userId: user.id,
            attachmentId: params.attachmentId,
          });
          const disposition = INLINE_MIME_TYPES.has(attachment.mimeType) ? "inline" : "attachment";
          return HttpServerResponse.raw(file, {
            contentType: attachment.mimeType || "application/octet-stream",
            headers: {
              "content-disposition": `${disposition}; filename="${encodeURIComponent(attachment.originalFileName)}"`,
            },
          });
        }),
    });
  }),
);
