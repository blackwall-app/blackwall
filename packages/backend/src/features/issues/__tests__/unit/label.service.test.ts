import "../../../../test/env.test";
import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { createColorFromString } from "@blackwall/shared";
import { labelData } from "../../label.data";
import { labelService } from "../../label.service";

describe("labelService", () => {
  afterEach(() => {
    mock.restore();
  });

  it("creates a label with a color derived from the name", async () => {
    spyOn(labelData, "getLabelByName").mockResolvedValue(undefined);
    const createSpy = spyOn(labelData, "createLabel").mockResolvedValue({
      id: "label-1",
      name: "Bug",
      colorKey: createColorFromString("Bug"),
      workspaceId: "ws-1",
    } as any);

    const label = await labelService.createLabel({ workspaceId: "ws-1", name: "Bug" });

    expect(label.colorKey).toBe(createColorFromString("Bug"));
    expect(createSpy).toHaveBeenCalledWith({
      name: "Bug",
      colorKey: createColorFromString("Bug"),
      workspaceId: "ws-1",
    });
  });

  it("throws when a label with the same name already exists", async () => {
    spyOn(labelData, "getLabelByName").mockResolvedValue({
      id: "label-1",
      name: "Bug",
      colorKey: "red-500",
      workspaceId: "ws-1",
    } as any);

    let error: unknown;
    try {
      await labelService.createLabel({ workspaceId: "ws-1", name: "Bug" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Label with this name already exists");
  });

  it("throws when deleting a label that does not exist", async () => {
    spyOn(labelData, "getLabelById").mockResolvedValue(undefined);

    let error: unknown;
    try {
      await labelService.deleteLabel({ workspaceId: "ws-1", labelId: "missing-id" });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Label not found");
  });

  it("deletes a label that exists", async () => {
    spyOn(labelData, "getLabelById").mockResolvedValue({
      id: "label-1",
      name: "Bug",
      colorKey: "red-500",
      workspaceId: "ws-1",
    } as any);
    const deleteSpy = spyOn(labelData, "deleteLabel").mockResolvedValue(undefined);

    await labelService.deleteLabel({ workspaceId: "ws-1", labelId: "label-1" });

    expect(deleteSpy).toHaveBeenCalledWith({ workspaceId: "ws-1", labelId: "label-1" });
  });
});
