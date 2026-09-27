import "../../test/env.test";
import { beforeEach, describe, expect, test } from "bun:test";
import { dbSchema } from "@blackwall/database";
import { createColorFromString, WORKSPACE_SLUG_HEADER } from "@blackwall/shared";
import { Effect } from "effect";
import { handleEffectRequest } from "../index";
import { env } from "../../lib/zod-env";
import { runApi } from "../../test/api";
import { createWorkspace, seedTestSetup } from "../../test/fixtures";
import { createTestDb, type TestDb } from "../../test/setup";

describe("labels api", () => {
  let testDb: TestDb;
  let seed: Awaited<ReturnType<typeof seedTestSetup>>;

  beforeEach(async () => {
    testDb = await createTestDb();
    seed = await seedTestSetup(testDb);
  });

  const authed = () => ({ cookie: seed.cookie, workspaceSlug: seed.workspace.slug });

  const insertLabel = async (name: string, workspaceId = seed.workspace.id) => {
    const [label] = await testDb.db
      .insert(dbSchema.label)
      .values({ name, colorKey: createColorFromString(name), workspaceId })
      .returning();
    return label;
  };

  const postLabel = (body: unknown) =>
    handleEffectRequest(
      new Request(`${env.APP_BASE_URL}/api/effect/labels`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: seed.cookie,
          [WORKSPACE_SLUG_HEADER]: seed.workspace.slug,
        },
        body: JSON.stringify(body),
      }),
    );

  test("rejects requests without a session", async () => {
    const error = await runApi({ workspaceSlug: seed.workspace.slug }, (client) =>
      Effect.flip(client.labels.list()),
    );
    expect(error).toMatchObject({ _tag: "Unauthorized", code: "UNAUTHORIZED" });
  });

  test("requires the workspace header", async () => {
    const error = await runApi({ cookie: seed.cookie }, (client) =>
      Effect.flip(client.labels.list()),
    );
    expect(error).toMatchObject({
      _tag: "MissingWorkspaceHeader",
      code: "MISSING_WORKSPACE_HEADER",
    });
  });

  test("lists nothing in a workspace without labels", async () => {
    const { labels } = await runApi(authed(), (client) => client.labels.list());
    expect(labels).toEqual([]);
  });

  test("lists only the labels of the current workspace", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    await insertLabel("Bug");
    await insertLabel("Feature");
    await insertLabel("Foreign", other.id);

    const { labels } = await runApi(authed(), (client) => client.labels.list());

    expect(labels.map((label) => label.name).sort()).toEqual(["Bug", "Feature"]);
    expect(labels[0]?.createdAt).toBeInstanceOf(Date);
  });

  test("creates a label with a color derived from its name", async () => {
    const { label } = await runApi(authed(), (client) =>
      client.labels.create({ payload: { name: "Bug" } }),
    );

    expect(label).toMatchObject({
      name: "Bug",
      colorKey: createColorFromString("Bug"),
      workspaceId: seed.workspace.id,
    });
    const stored = await testDb.db.query.label.findFirst({ where: { id: label.id } });
    expect(stored?.name).toBe("Bug");
  });

  test("rejects a name the workspace already has, ignoring case", async () => {
    await insertLabel("Bug");

    const error = await runApi(authed(), (client) =>
      Effect.flip(client.labels.create({ payload: { name: "BUG" } })),
    );

    expect(error).toMatchObject({
      _tag: "LabelNameAlreadyExists",
      code: "LABEL_NAME_ALREADY_EXISTS",
    });
  });

  test("allows a name another workspace already uses", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    await insertLabel("Bug", other.id);

    const { label } = await runApi(authed(), (client) =>
      client.labels.create({ payload: { name: "Bug" } }),
    );

    expect(label.workspaceId).toBe(seed.workspace.id);
  });

  test("keeps the Hono status codes for create", async () => {
    const created = await postLabel({ name: "Bug" });
    const duplicate = await postLabel({ name: "bug" });

    expect(created.status).toBe(201);
    expect(duplicate.status).toBe(400);
    expect(await duplicate.json()).toMatchObject({ code: "LABEL_NAME_ALREADY_EXISTS" });
  });

  test("rejects empty and overlong names", async () => {
    const empty = await postLabel({ name: "" });
    const overlong = await postLabel({ name: "A".repeat(51) });

    expect(empty.status).toBe(400);
    expect(await empty.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(overlong.status).toBe(400);
    expect(await overlong.json()).toMatchObject({ code: "VALIDATION_ERROR" });
    expect(await testDb.db.query.label.findMany()).toEqual([]);
  });

  test("gets a label by id and reports unknown ones", async () => {
    const bug = await insertLabel("Bug");

    const { label } = await runApi(authed(), (client) =>
      client.labels.get({ params: { labelId: bug.id } }),
    );
    const error = await runApi(authed(), (client) =>
      Effect.flip(
        client.labels.get({ params: { labelId: "00000000-0000-0000-0000-000000000000" } }),
      ),
    );

    expect(label.name).toBe("Bug");
    expect(error).toMatchObject({ _tag: "LabelNotFound", code: "LABEL_NOT_FOUND" });
  });

  test("deletes a label", async () => {
    const bug = await insertLabel("Bug");

    const result = await runApi(authed(), (client) =>
      client.labels.delete({ params: { labelId: bug.id } }),
    );
    const error = await runApi(authed(), (client) =>
      Effect.flip(client.labels.get({ params: { labelId: bug.id } })),
    );

    expect(result).toEqual({ success: true });
    expect(error._tag).toBe("LabelNotFound");
  });

  test("reports deleting an unknown label", async () => {
    const error = await runApi(authed(), (client) =>
      Effect.flip(
        client.labels.delete({ params: { labelId: "00000000-0000-0000-0000-000000000000" } }),
      ),
    );

    expect(error).toMatchObject({ _tag: "LabelNotFound", code: "LABEL_NOT_FOUND" });
  });

  test("can't read or delete labels of another workspace", async () => {
    const other = await createWorkspace(testDb, { slug: "other", displayName: "Other" });
    const foreign = await insertLabel("Foreign", other.id);

    const read = await runApi(authed(), (client) =>
      Effect.flip(client.labels.get({ params: { labelId: foreign.id } })),
    );
    const deleted = await runApi(authed(), (client) =>
      Effect.flip(client.labels.delete({ params: { labelId: foreign.id } })),
    );
    const listed = await runApi({ cookie: seed.cookie, workspaceSlug: "other" }, (client) =>
      Effect.flip(client.labels.list()),
    );

    expect(read._tag).toBe("LabelNotFound");
    expect(deleted._tag).toBe("LabelNotFound");
    expect(listed._tag).toBe("NotWorkspaceMember");
    expect(await testDb.db.query.label.findFirst({ where: { id: foreign.id } })).toBeDefined();
  });
});
