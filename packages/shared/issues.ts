import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";

export class IssueNotFound extends ApiError<IssueNotFound>()("IssueNotFound", {
  code: ErrorCode.ISSUE_NOT_FOUND,
  status: 404,
  message: "Issue not found",
}) {}
