import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { IssueNotFound } from "./issues";
import { IssueComment, TiptapDocument } from "./models";

export const CreateCommentSchema = Schema.Struct({
  content: TiptapDocument,
});

export type CreateComment = typeof CreateCommentSchema.Type;

export const CommentIssueParamsSchema = Schema.Struct({
  issueKey: Schema.String,
});

export type CommentIssueParams = typeof CommentIssueParamsSchema.Type;

export const CommentParamsSchema = Schema.Struct({
  issueKey: Schema.String,
  commentId: Schema.String,
});

export type CommentParams = typeof CommentParamsSchema.Type;

export const CommentResponse = Schema.Struct({
  comment: IssueComment,
});

export const CommentDeleteResponse = Schema.Struct({
  message: Schema.String,
});

export class CommentNotFound extends ApiError<CommentNotFound>()("CommentNotFound", {
  code: ErrorCode.COMMENT_NOT_FOUND,
  status: 404,
  message: "Comment not found",
}) {}

export class CommentsApi extends HttpApiGroup.make("comments")
  .add(
    HttpApiEndpoint.post("create", "/:issueKey/comments", {
      params: CommentIssueParamsSchema,
      payload: CreateCommentSchema,
      success: CommentResponse,
      error: IssueNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.delete("delete", "/:issueKey/comments/:commentId", {
      params: CommentParamsSchema,
      success: CommentDeleteResponse,
      error: [IssueNotFound, CommentNotFound],
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/issues") {}
