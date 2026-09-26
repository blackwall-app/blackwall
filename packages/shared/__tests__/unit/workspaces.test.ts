import { describe, expect, test } from "bun:test";
import { Result, Schema } from "effect";
import { CreateWorkspaceSchema, Workspace, WorkspaceSlug } from "../../workspaces";

describe("workspace schemas", () => {
  test("accepts a valid create payload", () => {
    const result = Schema.decodeUnknownResult(CreateWorkspaceSchema)({
      displayName: "Effect WS",
      slug: "effectws",
    });
    expect(Result.isSuccess(result)).toBe(true);
  });

  test("rejects display names shorter than 2 characters", () => {
    const result = Schema.decodeUnknownResult(CreateWorkspaceSchema)({
      displayName: "x",
      slug: "effectws",
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  test("rejects slugs longer than 10 characters", () => {
    const result = Schema.decodeUnknownResult(CreateWorkspaceSchema)({
      displayName: "Effect WS",
      slug: "way-too-long-slug",
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  test("rejects the reserved api slug on create", () => {
    const result = Schema.decodeUnknownResult(CreateWorkspaceSchema)({
      displayName: "Api",
      slug: "api",
    });
    expect(Result.isFailure(result)).toBe(true);
  });

  test("rejects the reserved api slug on workspaces", () => {
    const row = { displayName: "Api", id: "1", logoUrl: null, slug: "api" };
    expect(Result.isFailure(Schema.decodeUnknownResult(Workspace)(row))).toBe(true);
    expect(Result.isFailure(Schema.decodeUnknownResult(WorkspaceSlug)("api"))).toBe(true);
  });

  test("rejects the reserved api slug in create payloads", () => {
    const result = Schema.decodeUnknownResult(CreateWorkspaceSchema)({
      displayName: "Api",
      slug: "api",
    });
    expect(Result.isFailure(result)).toBe(true);
  });
});
