import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { Authorization, WorkspaceMembership } from "./auth";
import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";
import { Label } from "./models";

export const CreateLabelSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(50))),
});

export type CreateLabel = typeof CreateLabelSchema.Type;

export const LabelIdParamsSchema = Schema.Struct({
  labelId: Schema.String,
});

export type LabelIdParams = typeof LabelIdParamsSchema.Type;

export const LabelResponse = Schema.Struct({
  label: Label,
});

export const LabelListResponse = Schema.Struct({
  labels: Schema.Array(Label),
});

export const LabelDeleteResponse = Schema.Struct({
  success: Schema.Boolean,
});

export class LabelNotFound extends ApiError<LabelNotFound>()("LabelNotFound", {
  code: ErrorCode.LABEL_NOT_FOUND,
  status: 404,
  message: "Label not found",
}) {}

/** Names are unique per workspace, ignoring case. */
export class LabelNameAlreadyExists extends ApiError<LabelNameAlreadyExists>()(
  "LabelNameAlreadyExists",
  {
    code: ErrorCode.LABEL_NAME_ALREADY_EXISTS,
    status: 400,
    message: "Label with this name already exists",
  },
) {}

export class LabelsApi extends HttpApiGroup.make("labels")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: LabelListResponse,
    }),
  )
  .add(
    HttpApiEndpoint.get("get", "/:labelId", {
      params: LabelIdParamsSchema,
      success: LabelResponse,
      error: LabelNotFound,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateLabelSchema,
      success: LabelResponse.pipe(HttpApiSchema.status(201)),
      error: LabelNameAlreadyExists,
    }),
  )
  .add(
    HttpApiEndpoint.delete("delete", "/:labelId", {
      params: LabelIdParamsSchema,
      success: LabelDeleteResponse,
      error: LabelNotFound,
    }),
  )
  .middleware(WorkspaceMembership)
  .middleware(Authorization)
  .prefix("/labels") {}
