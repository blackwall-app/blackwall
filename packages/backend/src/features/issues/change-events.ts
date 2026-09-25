import type {
  Issue,
  IssueChangeEventType,
  IssueFieldChanges,
  NewIssueChangeEvent,
} from "@blackwall/database/schema";

type ChangeEventContext = {
  issueId: string;
  workspaceId: string;
  actorId: string;
};

type ChangeEventRefs = Pick<
  NewIssueChangeEvent,
  "commentId" | "attachmentId" | "labelId" | "timeEntryId"
>;

export function buildChangeEvent(
  ctx: ChangeEventContext,
  eventType: IssueChangeEventType,
  refs: ChangeEventRefs = {},
): NewIssueChangeEvent {
  return { ...ctx, eventType, ...refs };
}

export function buildIssueUpdatedEvent(
  ctx: ChangeEventContext,
  updates: Partial<Issue>,
  original: Issue,
): NewIssueChangeEvent | null {
  const changes = computeFieldChanges(updates, original);
  const descriptionChanged =
    updates.description !== undefined &&
    JSON.stringify(updates.description) !== JSON.stringify(original.description);

  if (Object.keys(changes).length === 0 && !descriptionChanged) return null;

  return {
    ...ctx,
    eventType: determineEventType(changes, descriptionChanged),
    changes: Object.keys(changes).length > 0 ? changes : null,
  };
}

function computeFieldChanges(updates: Partial<Issue>, original: Issue): IssueFieldChanges {
  const changes: IssueFieldChanges = {};

  for (const key of Object.keys(updates) as Array<keyof Issue>) {
    if (key === "description" || key === "descriptionText") continue;

    const oldValue = original[key];
    const newValue = updates[key];

    if (oldValue === newValue) continue;

    (changes as Record<string, { from: unknown; to: unknown }>)[key] = {
      from: oldValue ?? null,
      to: newValue ?? null,
    };
  }

  return changes;
}

function determineEventType(
  changes: IssueFieldChanges,
  descriptionChanged: boolean,
): IssueChangeEventType {
  if (changes.summary) return "summary_changed";
  if (descriptionChanged) return "description_changed";
  if (changes.status) return "status_changed";
  if (changes.priority) return "priority_changed";
  if (changes.assignedToId) return "assignee_changed";
  return "issue_updated";
}
