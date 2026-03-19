import { describe, expect, it } from "bun:test";
import { buildChangeEvent, buildIssueUpdatedEvent } from "../../change-events";

describe("change-events", () => {
  const ctx = {
    issueId: "issue-1",
    workspaceId: "workspace-1",
    actorId: "user-1",
  };

  function buildOriginalIssue(overrides: Record<string, unknown> = {}) {
    return {
      id: "issue-1",
      key: "TES-1",
      keyNumber: 1,
      summary: "Original summary",
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Original" }] }],
      },
      status: "to_do",
      priority: "medium",
      sortOrder: 0,
      workspaceId: "workspace-1",
      teamId: "team-1",
      createdById: "user-1",
      assignedToId: null,
      sprintId: null,
      estimationPoints: null,
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      ...overrides,
    } as any;
  }

  it("builds simple change events with an optional related entity id", () => {
    expect(buildChangeEvent(ctx, "attachment_added", "attachment-1")).toEqual({
      ...ctx,
      eventType: "attachment_added",
      relatedEntityId: "attachment-1",
    });
  });

  it("returns null when updates do not change any fields, including equivalent descriptions", () => {
    const original = buildOriginalIssue();

    expect(
      buildIssueUpdatedEvent(
        ctx,
        {
          summary: "Original summary",
          description: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Original" }] }],
          },
        },
        original,
      ),
    ).toBeNull();
  });

  it("includes all changed fields and prioritizes summary-specific events", () => {
    const original = buildOriginalIssue();

    const event = buildIssueUpdatedEvent(
      ctx,
      {
        summary: "Updated summary",
        status: "done",
      },
      original,
    );

    expect(event).not.toBeNull();
    expect(event?.eventType).toBe("summary_changed");
    expect(event?.changes).toMatchObject({
      summary: {
        from: "Original summary",
        to: "Updated summary",
      },
      status: {
        from: "to_do",
        to: "done",
      },
    });
  });
});
