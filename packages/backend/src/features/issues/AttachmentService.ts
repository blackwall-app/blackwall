import { Database } from "@blackwall/database/effect";
import type { IssueAttachment } from "@blackwall/database/schema";
import { jobService } from "@blackwall/queue";
import { AttachmentFileNotFound, AttachmentNotFound, IssueNotFound } from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { deleteFile, getFile, saveFile } from "../../lib/file-upload";
import { attachmentData } from "./attachment.data";
import { IssueService } from "./IssueService";

/** How long an uploaded file may stay unlinked from an issue before it's deleted. */
export const ORPHAN_ATTACHMENT_TTL_MS = 24 * 60 * 60 * 1000;

export interface AttachmentUpload {
  readonly name: string;
  readonly contentType: string;
  readonly bytes: Uint8Array;
}

/**
 * Any workspace member can upload, read, and delete attachments of any issue in
 * the workspace. Team membership isn't checked.
 */
export class AttachmentService extends Context.Service<
  AttachmentService,
  {
    readonly uploadToIssue: (input: {
      workspaceSlug: string;
      workspaceId: string;
      issueKey: string;
      userId: string;
      file: AttachmentUpload;
    }) => Effect.Effect<IssueAttachment, IssueNotFound>;
    /**
     * An attachment not linked to an issue yet, such as an image in the
     * description of an issue being created. It's deleted after
     * `ORPHAN_ATTACHMENT_TTL_MS` unless associated.
     */
    readonly uploadOrphan: (input: {
      workspaceSlug: string;
      userId: string;
      file: AttachmentUpload;
    }) => Effect.Effect<IssueAttachment>;
    /** Links the user's own orphans to the issue. Other ids are skipped. */
    readonly associate: (input: {
      workspaceId: string;
      issueKey: string;
      userId: string;
      attachmentIds: ReadonlyArray<string>;
    }) => Effect.Effect<void, IssueNotFound>;
    readonly getAttachment: (input: {
      workspaceId: string;
      issueKey: string;
      attachmentId: string;
    }) => Effect.Effect<IssueAttachment, IssueNotFound | AttachmentNotFound>;
    readonly deleteAttachment: (input: {
      workspaceId: string;
      issueKey: string;
      attachmentId: string;
      userId: string;
    }) => Effect.Effect<void, IssueNotFound | AttachmentNotFound>;
    /**
     * The attachment and its file. Orphans are readable by their uploader,
     * issue attachments by any member of the issue's workspace.
     */
    readonly getDownload: (input: {
      userId: string;
      attachmentId: string;
    }) => Effect.Effect<
      { attachment: IssueAttachment; file: Blob },
      AttachmentNotFound | AttachmentFileNotFound
    >;
    /** Deletes the attachment and its file if it's still an orphan. Runs as a delayed job. */
    readonly cleanupOrphanAttachment: (input: { attachmentId: string }) => Effect.Effect<void>;
  }
>()("blackwall/AttachmentService") {
  static readonly layer = Layer.effect(
    AttachmentService,
    Effect.gen(function* () {
      const database = yield* Database;
      const issues = yield* IssueService;

      const storeFile = Effect.fnUntraced(function* (input: {
        workspaceSlug: string;
        userId: string;
        file: AttachmentUpload;
      }) {
        const { file } = input;
        const filePath = yield* Effect.tryPromise(() =>
          saveFile(new File([new Uint8Array(file.bytes)], file.name, { type: file.contentType }), {
            directory: `workspaces/${input.workspaceSlug}/issue-attachments`,
            name: file.name.split(".").slice(0, -1).join("."),
          }),
        ).pipe(Effect.orDie);
        return {
          userId: input.userId,
          filePath,
          mimeType: file.contentType,
          originalFileName: file.name,
          sizeBytes: file.bytes.length,
        };
      });

      const uploadToIssue = Effect.fn("AttachmentService.uploadToIssue")(
        function* (input: {
          workspaceSlug: string;
          workspaceId: string;
          issueKey: string;
          userId: string;
          file: AttachmentUpload;
        }) {
          const issue = yield* issues.requireIssue(input);
          const values = yield* storeFile(input);
          return yield* database.transaction((tx) =>
            attachmentData.insertAttachment(tx, { ...values, issue }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const uploadOrphan = Effect.fn("AttachmentService.uploadOrphan")(
        function* (input: { workspaceSlug: string; userId: string; file: AttachmentUpload }) {
          const values = yield* storeFile(input);
          const attachment = yield* database.use((db) =>
            attachmentData.insertOrphanAttachment(db, values),
          );
          yield* Effect.tryPromise(() =>
            jobService.addJob({
              type: "cleanup-orphan-attachment",
              payload: { attachmentId: attachment.id },
              delay: ORPHAN_ATTACHMENT_TTL_MS,
            }),
          ).pipe(Effect.orDie);
          return attachment;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const associate = Effect.fn("AttachmentService.associate")(
        function* (input: {
          workspaceId: string;
          issueKey: string;
          userId: string;
          attachmentIds: ReadonlyArray<string>;
        }) {
          const issue = yield* issues.requireIssue(input);
          if (input.attachmentIds.length === 0) {
            return;
          }
          yield* database.transaction((tx) =>
            attachmentData.associateAttachmentsWithIssue(tx, {
              userId: input.userId,
              issue,
              attachmentIds: input.attachmentIds,
            }),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const requireAttachment = Effect.fnUntraced(function* (input: {
        issueId: string;
        attachmentId: string;
      }) {
        const attachment = yield* database.use((db) => attachmentData.getAttachmentById(input, db));
        if (attachment === undefined) {
          return yield* new AttachmentNotFound();
        }
        return attachment;
      });

      const getAttachment = Effect.fn("AttachmentService.getAttachment")(
        function* (input: { workspaceId: string; issueKey: string; attachmentId: string }) {
          const issue = yield* issues.requireIssue(input);
          return yield* requireAttachment({ issueId: issue.id, attachmentId: input.attachmentId });
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const deleteAttachment = Effect.fn("AttachmentService.deleteAttachment")(
        function* (input: {
          workspaceId: string;
          issueKey: string;
          attachmentId: string;
          userId: string;
        }) {
          const issue = yield* issues.requireIssue(input);
          const attachment = yield* requireAttachment({
            issueId: issue.id,
            attachmentId: input.attachmentId,
          });
          yield* database.transaction((tx) =>
            attachmentData.deleteAttachment(tx, {
              attachmentId: attachment.id,
              issue,
              actorId: input.userId,
            }),
          );
          deleteFile(attachment.filePath);
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const getDownload = Effect.fn("AttachmentService.getDownload")(
        function* (input: { userId: string; attachmentId: string }) {
          const attachment = yield* database.use((db) =>
            attachmentData.getAttachmentForServing(input, db),
          );
          if (attachment === undefined) {
            return yield* new AttachmentNotFound();
          }
          const { file, exists } = yield* Effect.promise(() => getFile(attachment.filePath));
          if (!exists) {
            return yield* new AttachmentFileNotFound();
          }
          return { attachment, file };
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const cleanupOrphanAttachment = Effect.fn("AttachmentService.cleanupOrphanAttachment")(
        function* (input: { attachmentId: string }) {
          const deleted = yield* database.use((db) =>
            attachmentData.deleteOrphanAttachment(input, db),
          );
          if (deleted !== undefined) {
            deleteFile(deleted.filePath);
          }
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      return AttachmentService.of({
        uploadToIssue,
        uploadOrphan,
        associate,
        getAttachment,
        deleteAttachment,
        getDownload,
        cleanupOrphanAttachment,
      });
    }),
  );
}
