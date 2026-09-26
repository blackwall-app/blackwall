import { ErrorCode } from "./error-codes";
import { ApiError } from "./errors";

export class TeamNotFoundOrAccessDenied extends ApiError<TeamNotFoundOrAccessDenied>()(
  "TeamNotFoundOrAccessDenied",
  {
    code: ErrorCode.TEAM_NOT_FOUND_OR_ACCESS_DENIED,
    status: 404,
    message: "Team not found or access denied",
  },
) {}
