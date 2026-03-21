import { ErrorCode } from "@blackwall/shared";
import { m } from "@/paraglide/messages.js";

const errorMessageMap: Record<string, () => string> = {
  [ErrorCode.INTERNAL_ERROR]: () => m.error_internal_error(),
  [ErrorCode.NOT_FOUND]: () => m.error_not_found(),
  [ErrorCode.VALIDATION_ERROR]: () => m.error_validation_error(),
  [ErrorCode.BAD_REQUEST]: () => m.error_bad_request(),
  [ErrorCode.HTTP_EXCEPTION]: () => m.error_http_exception(),
  [ErrorCode.CONFLICT]: () => m.error_conflict(),
  [ErrorCode.UNAUTHORIZED]: () => m.error_unauthorized(),
  [ErrorCode.FORBIDDEN]: () => m.error_forbidden(),
  [ErrorCode.MISSING_WORKSPACE_HEADER]: () => m.error_missing_workspace_header(),
  [ErrorCode.WORKSPACE_NOT_FOUND]: () => m.error_workspace_not_found(),
  [ErrorCode.NOT_WORKSPACE_MEMBER]: () => m.error_not_workspace_member(),
  [ErrorCode.MEMBER_NOT_FOUND]: () => m.error_member_not_found(),
  [ErrorCode.TEAM_NOT_FOUND]: () => m.error_team_not_found(),
  [ErrorCode.TEAM_NOT_FOUND_OR_ACCESS_DENIED]: () => m.error_team_not_found_or_access_denied(),
  [ErrorCode.TEAM_NOT_FOUND_OR_NOT_MEMBER]: () => m.error_team_not_found_or_not_member(),
  [ErrorCode.NOT_TEAM_MEMBER]: () => m.error_not_team_member(),
  [ErrorCode.NOT_MEMBER_OF_THIS_TEAM]: () => m.error_not_member_of_this_team(),
  [ErrorCode.TEAM_KEY_ALREADY_EXISTS]: () => m.error_team_key_already_exists(),
  [ErrorCode.ISSUE_NOT_FOUND]: () => m.error_issue_not_found(),
  [ErrorCode.ISSUES_NOT_ACCESSIBLE]: () => m.error_issues_not_accessible(),
  [ErrorCode.PREVIOUS_AND_NEXT_ISSUES_MUST_BE_DIFFERENT]: () =>
    m.error_previous_and_next_issues_must_be_different(),
  [ErrorCode.PREVIOUS_ISSUE_NOT_IN_TARGET_COLUMN]: () =>
    m.error_previous_issue_not_in_target_column(),
  [ErrorCode.NEXT_ISSUE_NOT_IN_TARGET_COLUMN]: () => m.error_next_issue_not_in_target_column(),
  [ErrorCode.TARGET_COLUMN_REQUIRES_ADJACENT_ISSUE]: () =>
    m.error_target_column_requires_adjacent_issue(),
  [ErrorCode.UNABLE_TO_DETERMINE_ISSUE_SORT_ORDER]: () =>
    m.error_unable_to_determine_issue_sort_order(),
  [ErrorCode.LABEL_NOT_FOUND]: () => m.error_label_not_found(),
  [ErrorCode.LABEL_NAME_ALREADY_EXISTS]: () => m.error_label_name_already_exists(),
  [ErrorCode.ISSUE_SPRINT_NOT_FOUND]: () => m.error_issue_sprint_not_found(),
  [ErrorCode.TARGET_SPRINT_NOT_FOUND]: () => m.error_target_sprint_not_found(),
  [ErrorCode.CANNOT_START_ARCHIVED_SPRINT]: () => m.error_cannot_start_archived_sprint(),
  [ErrorCode.CANNOT_START_COMPLETED_SPRINT]: () => m.error_cannot_start_completed_sprint(),
  [ErrorCode.SPRINT_ALREADY_ACTIVE]: () => m.error_sprint_already_active(),
  [ErrorCode.CANNOT_START_WHILE_SPRINT_ACTIVE]: () => m.error_cannot_start_while_sprint_active(),
  [ErrorCode.CANNOT_UPDATE_ARCHIVED_SPRINT]: () => m.error_cannot_update_archived_sprint(),
  [ErrorCode.CANNOT_UPDATE_COMPLETED_SPRINT]: () => m.error_cannot_update_completed_sprint(),
  [ErrorCode.CANNOT_COMPLETE_ARCHIVED_SPRINT]: () => m.error_cannot_complete_archived_sprint(),
  [ErrorCode.SPRINT_ALREADY_COMPLETED]: () => m.error_sprint_already_completed(),
  [ErrorCode.ONLY_ACTIVE_SPRINTS_CAN_BE_COMPLETED]: () =>
    m.error_only_active_sprints_can_be_completed(),
  [ErrorCode.SPRINT_NOT_CURRENTLY_ACTIVE]: () => m.error_sprint_not_currently_active(),
  [ErrorCode.TARGET_SPRINT_MUST_BE_PLANNED]: () => m.error_target_sprint_must_be_planned(),
  [ErrorCode.SPRINT_ALREADY_ARCHIVED]: () => m.error_sprint_already_archived(),
  [ErrorCode.CANNOT_ARCHIVE_ACTIVE_SPRINT]: () => m.error_cannot_archive_active_sprint(),
  [ErrorCode.USER_NOT_FOUND]: () => m.error_user_not_found(),
  [ErrorCode.NO_AVATAR_FILE_PROVIDED]: () => m.error_no_avatar_file_provided(),
  [ErrorCode.ONLY_IMAGE_FILES_SUPPORTED]: () => m.error_only_image_files_supported(),
  [ErrorCode.IMAGE_TOO_LARGE]: () => m.error_image_too_large(),
  [ErrorCode.FAILED_TO_CHANGE_PASSWORD]: () => m.error_failed_to_change_password(),
  [ErrorCode.ATTACHMENT_NOT_FOUND]: () => m.error_attachment_not_found(),
  [ErrorCode.ATTACHMENT_FILE_NOT_FOUND]: () => m.error_attachment_file_not_found(),
  [ErrorCode.FILE_MISSING_OR_INVALID]: () => m.error_file_missing_or_invalid(),
  [ErrorCode.COMMENT_NOT_FOUND]: () => m.error_comment_not_found(),
  [ErrorCode.INVITATION_NOT_FOUND_OR_EXPIRED]: () => m.error_invitation_not_found_or_expired(),
  [ErrorCode.DURATION_MUST_BE_POSITIVE]: () => m.error_duration_must_be_positive(),
  [ErrorCode.TIME_ENTRY_NOT_FOUND]: () => m.error_time_entry_not_found(),
  [ErrorCode.INVALID_EMAIL_OR_PASSWORD]: () => m.error_invalid_email_or_password(),
  [ErrorCode.INVALID_TOKEN]: () => m.error_invalid_token(),
  [ErrorCode.TOKEN_EXPIRED]: () => m.error_token_expired(),
  [ErrorCode.USER_ALREADY_EXISTS]: () => m.error_user_already_exists(),
  [ErrorCode.EMAIL_NOT_VERIFIED]: () => m.error_email_not_verified(),
  [ErrorCode.TOO_MANY_REQUESTS]: () => m.error_too_many_requests(),
};

export function localizeErrorCode(
  code: string | undefined | null,
  fallbackMessage?: string | null,
): string {
  const trimmedFallback = fallbackMessage?.trim();
  if (!code?.trim()) {
    return trimmedFallback || m.common_unexpected_error();
  }
  const localized = errorMessageMap[code];
  if (localized) {
    return localized();
  }
  return trimmedFallback || m.common_unexpected_error();
}
