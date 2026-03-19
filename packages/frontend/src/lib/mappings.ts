import type { Issue } from "@blackwall/database/schema";
import CircleIcon from "lucide-solid/icons/circle";
import CircleCheck from "lucide-solid/icons/circle-check";
import CircleFadingArrowUpIcon from "lucide-solid/icons/circle-fading-arrow-up";
import type { JSX } from "solid-js";
import { m } from "@/paraglide/messages.js";

export type BaseMapping = {
  label: string;
  textClass?: string;
  icon?: (props: { class?: string }) => JSX.Element;
};

export const issueMappings = {
  status: {
    to_do: {
      label: m.issue_status_to_do(),
      textClass: "text-theme-teal",
      icon: CircleIcon,
    },
    in_progress: {
      label: m.issue_status_in_progress(),
      textClass: "text-theme-blue",
      icon: CircleFadingArrowUpIcon,
    },
    done: {
      label: m.issue_status_done(),
      textClass: "text-theme-green",
      icon: CircleCheck,
    },
  } as const satisfies Record<Issue["status"], BaseMapping>,
  priority: {
    low: {
      label: m.issue_priority_low(),
      textClass: "text-theme-green",
    },
    medium: {
      label: m.issue_priority_medium(),
      textClass: "text-theme-blue",
    },
    high: {
      label: m.issue_priority_high(),
      textClass: "text-theme-yellow",
    },
    urgent: {
      label: m.issue_priority_urgent(),
      textClass: "text-theme-red",
    },
  } as const satisfies Record<Issue["priority"], BaseMapping>,
};

export function mappingToOptionArray<T extends Record<string, BaseMapping>>(mapping: T) {
  return Object.entries(mapping).map(([id, rest]) => {
    return {
      id: id as keyof T,
      ...rest,
    };
  });
}
