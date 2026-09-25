import { describe, expect, test } from "bun:test";
import { tiptapToPlainText } from "../../index";

describe("tiptapToPlainText", () => {
  test("joins text nodes and skips node types and marks", () => {
    const document = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Fix the" },
            { type: "text", text: "login", marks: [{ type: "bold" }] },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "flow" }] }],
            },
          ],
        },
      ],
    };

    expect(tiptapToPlainText(document)).toBe("Fix the login flow");
  });

  test("returns an empty string for empty or invalid input", () => {
    expect(tiptapToPlainText({ type: "doc", content: [] })).toBe("");
    expect(tiptapToPlainText(null)).toBe("");
    expect(tiptapToPlainText("not a document")).toBe("");
  });
});
