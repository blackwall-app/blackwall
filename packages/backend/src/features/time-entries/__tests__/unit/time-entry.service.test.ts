import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { BadRequestError, NotFoundError } from "../../../../lib/errors";
import { timeEntryData } from "../../time-entry.data";
import { timeEntryService } from "../../time-entry.service";

describe("timeEntryService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("rejects non-positive durations", async () => {
    let error: unknown;
    try {
      await timeEntryService.createTimeEntry({
        issueId: "issue-1",
        workspaceId: "ws-1",
        userId: "user-1",
        duration: 0,
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BadRequestError);
  });

  it("creates a time entry when the duration is positive", async () => {
    const createSpy = spyOn(timeEntryData, "createTimeEntry").mockResolvedValue({
      id: "entry-1",
      issueId: "issue-1",
      workspaceId: "ws-1",
      userId: "user-1",
      duration: 30,
      description: "Focused work",
      deletedAt: null,
      createdAt: new Date(),
    } as any);

    const entry = await timeEntryService.createTimeEntry({
      issueId: "issue-1",
      workspaceId: "ws-1",
      userId: "user-1",
      duration: 30,
      description: "Focused work",
    });

    expect(entry.duration).toBe(30);
    expect(createSpy).toHaveBeenCalledWith({
      issueId: "issue-1",
      workspaceId: "ws-1",
      userId: "user-1",
      duration: 30,
      description: "Focused work",
    });
  });

  it("throws NotFoundError when deleting a time entry that does not exist", async () => {
    spyOn(timeEntryData, "getTimeEntryById").mockResolvedValue(undefined);

    let error: unknown;
    try {
      await timeEntryService.deleteTimeEntry({
        timeEntryId: "missing-id",
        issueId: "issue-1",
        userId: "user-1",
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(NotFoundError);
  });

  it("soft deletes the time entry when it exists", async () => {
    spyOn(timeEntryData, "getTimeEntryById").mockResolvedValue({
      id: "entry-1",
    } as any);
    const deleteSpy = spyOn(timeEntryData, "softDeleteTimeEntry").mockResolvedValue(undefined);

    await timeEntryService.deleteTimeEntry({
      timeEntryId: "entry-1",
      issueId: "issue-1",
      userId: "user-1",
    });

    expect(deleteSpy).toHaveBeenCalledWith({ timeEntryId: "entry-1" });
  });
});
