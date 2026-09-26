import { Schema } from "effect";

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {
    message: Schema.String,
  },
  { httpApiStatus: 401 },
) {}

export class WorkspaceNotFound extends Schema.TaggedError<WorkspaceNotFound>()(
  "WorkspaceNotFound",
  {
    message: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

export class NotWorkspaceMember extends Schema.TaggedError<NotWorkspaceMember>()(
  "NotWorkspaceMember",
  {
    message: Schema.String,
  },
  { httpApiStatus: 403 },
) {}

export class WorkspaceSlugTaken extends Schema.TaggedError<WorkspaceSlugTaken>()(
  "WorkspaceSlugTaken",
  {
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}
