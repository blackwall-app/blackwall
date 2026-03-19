import { Badge } from "@/components/custom-ui/badge";
import type { SerializedIssueSprint } from "@blackwall/database/schema";
import { m } from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";

const statusStyles: Record<
  SerializedIssueSprint["status"],
  { label: string; color: "green" | "blue" | "normal" }
> = {
  planned: { label: m.sprint_status_badge_planned(), color: "normal" },
  active: { label: m.sprint_status_badge_active(), color: "green" },
  completed: { label: m.sprint_status_badge_completed(), color: "blue" },
};

export function SprintStatusBadge(props: { sprint: SerializedIssueSprint; class?: string }) {
  const style = () => statusStyles[props.sprint.status];

  return (
    <Badge size="sm" color={style().color} class={cn("whitespace-nowrap", props.class)}>
      {style().label}
    </Badge>
  );
}
