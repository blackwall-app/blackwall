import { UserAvatar } from "@/components/custom-ui/avatar";
import type { IssueChangeEventType, SerializedUser } from "@blackwall/database/schema";
import type { InferDbType } from "@blackwall/database/types";
import { issueMappings } from "@/lib/mappings";
import { formatRelative } from "@/lib/dates";
import { m } from "@/paraglide/messages.js";
import { createMemo, Index, Match, Show, Switch } from "solid-js";
import { IssueComment, IssueCommentForm } from "./issue-comment";

const IMPORTANT_EVENT_TYPES: IssueChangeEventType[] = [
  "issue_created",
  "assignee_changed",
  "priority_changed",
  "time_logged",
] as const;

type IssueWithCommentsAndEvents = InferDbType<
  "issue",
  {
    comments: {
      with: {
        author: true;
      };
    };
    changeEvents: {
      with: {
        actor: true;
      };
    };
  }
>;

type Comment = IssueWithCommentsAndEvents["comments"][number];
type Event = IssueWithCommentsAndEvents["changeEvents"][number];

type CommentTimelineItem = {
  type: "comment";
  date: string;
  data: Comment;
};

type EventTimelineItem = {
  type: "event";
  date: string;
  data: Event;
  assignedTo: SerializedUser | null;
};

export type TimelineItem = CommentTimelineItem | EventTimelineItem;

export type IssueActivityLogProps = {
  issue: IssueWithCommentsAndEvents;
  assignableUsers: SerializedUser[];
  workspaceSlug: string;
};

export type IssueEventItemProps = {
  event: Event;
  assignedTo: SerializedUser | null;
};

function buildTimelineItems(
  comments: Comment[],
  events: Event[],
  assignableUsers: SerializedUser[],
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const comment of comments) {
    items.push({
      type: "comment",
      date: comment.createdAt,
      data: comment,
    });
  }

  for (const event of events) {
    if (IMPORTANT_EVENT_TYPES.includes(event.eventType)) {
      const assignedToId = event.changes?.assignedToId?.to;
      const assignedTo = assignedToId
        ? (assignableUsers.find((user) => user.id === assignedToId) ?? null)
        : null;

      items.push({
        type: "event",
        date: event.createdAt,
        data: event,
        assignedTo,
      });
    }
  }

  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function formatEventTypeText(eventType: IssueChangeEventType): string {
  switch (eventType) {
    case "issue_created":
      return m.issue_activity_event_created();
    case "assignee_changed":
      return m.issue_activity_event_assigned_to();
    case "priority_changed":
      return m.issue_activity_event_priority_to();
    case "status_changed":
      return m.issue_activity_event_status_to();
    case "time_logged":
      return m.issue_activity_event_logged_time();
    default:
      return eventType;
  }
}

function getEventEntityText(event: Event, assignedTo: SerializedUser | null): string | undefined {
  switch (event.eventType) {
    case "assignee_changed": {
      const assignedToId = event.changes?.assignedToId?.to;
      if (assignedToId === event.actorId) {
        return m.issue_activity_entity_themselves();
      }
      if (assignedTo) {
        return assignedTo.name;
      }
      return assignedToId ?? m.issue_activity_entity_nobody();
    }
    case "priority_changed": {
      const toPriority = event.changes?.priority?.to;
      if (!toPriority) return undefined;
      return issueMappings.priority[toPriority].label;
    }
    default:
      return undefined;
  }
}

export function IssueActivityLog(props: IssueActivityLogProps) {
  const timelineItems = createMemo(() =>
    buildTimelineItems(props.issue.comments, props.issue.changeEvents, props.assignableUsers),
  );

  return (
    <div class="flex flex-col gap-4" data-testid="issue-activity-log">
      <Index each={timelineItems()}>
        {(item) => {
          return (
            <Switch>
              <Match when={item().type === "comment"}>
                <IssueComment
                  comment={(item() as CommentTimelineItem).data}
                  issueKey={props.issue.key}
                  workspaceSlug={props.workspaceSlug}
                />
              </Match>
              <Match when={item().type === "event"}>
                <IssueEventItem
                  event={(item() as EventTimelineItem).data}
                  assignedTo={(item() as EventTimelineItem).assignedTo}
                />
              </Match>
            </Switch>
          );
        }}
      </Index>

      <IssueCommentForm issue={props.issue} workspaceSlug={props.workspaceSlug} />
    </div>
  );
}

export function IssueEventItem(props: IssueEventItemProps) {
  const eventTypeText = createMemo(() => formatEventTypeText(props.event.eventType));
  const eventEntityText = createMemo(() => getEventEntityText(props.event, props.assignedTo));

  return (
    <div class="flex flex-row gap-1 flex-wrap items-center text-muted-foreground text-sm pl-4">
      <UserAvatar user={props.event.actor as unknown as SerializedUser} size="5" />
      <p>{props.event.actor.name}</p>
      <p class="font-medium">{eventTypeText()}</p>
      <Show when={eventEntityText()}>{(entity) => <p>{entity()}</p>}</Show>
      <span class="text-muted-foreground">•</span>
      <p class="text-muted-foreground">{formatRelative(props.event.createdAt, new Date())}</p>
    </div>
  );
}
