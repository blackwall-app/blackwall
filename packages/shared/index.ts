export { ErrorCode, type ApiErrorCode } from "./error-codes";
export { tiptapDocumentSchema } from "./tiptap/tiptap-document-schema";
export { validateTiptapContent } from "./tiptap/validate";
export { tiptapToPlainText } from "./tiptap/plain-text";
export { Api, WorkspacesApi } from "./api";
export { Authorization, CurrentUser, type SessionUser } from "./auth";
export {
  NotWorkspaceMember,
  Unauthorized,
  WorkspaceNotFound,
  WorkspaceSlugTaken,
} from "./effect-errors";
export {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
  Workspace,
  WorkspaceIdParamsSchema,
  WorkspaceListResponse,
  WorkspaceMemberListSchema,
  WorkspaceMemberParamsSchema,
  WorkspaceMemberResponseSchema,
  WorkspaceMemberSchema,
  WorkspaceResponse,
  WorkspaceSlug,
  WorkspaceSlugParamsSchema,
} from "./workspaces";
export type {
  CreateWorkspace,
  UpdateWorkspace,
  WorkspaceIdParams,
  WorkspaceMember,
  WorkspaceMemberList,
  WorkspaceMemberParams,
  WorkspaceMemberResponse,
  WorkspaceSlugParams,
} from "./workspaces";

export const possibleColors = [
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "violet",
  "purple",
  "pink",
] as const;

export const createColorFromString = (input: string): (typeof possibleColors)[number] => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }

  const index = Math.abs(hash) % possibleColors.length;
  return possibleColors[index] ?? "blue";
};
