import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";

describe("Label Routes", () => {
  const getCtx = useTestContext();

  const createLabel = async (name: string) => {
    const { client, headers } = getCtx();
    const res = await client.api.labels.$post(
      {
        json: { name },
      },
      {
        headers: headers(),
      },
    );
    const json = (await res.json()) as { label: { id: string; name: string; colorKey: string } };
    return { res, json };
  };

  describe("GET /labels", () => {
    it("should return empty array when no labels exist", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.labels.$get(
        {},
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.labels).toHaveLength(0);
    });

    it("should return list of labels for workspace", async () => {
      await createLabel("Bug");
      await createLabel("Feature");

      const { client, headers } = getCtx();
      const res = await client.api.labels.$get(
        {},
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.labels).toHaveLength(2);
    });
  });

  describe("GET /labels/:labelId", () => {
    it("should return label by id", async () => {
      const { json: createJson } = await createLabel("Bug");

      const { client, headers } = getCtx();
      const res = await client.api.labels[":labelId"].$get(
        {
          param: { labelId: createJson.label.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as { label: { name: string } };
      expect(json.label).toBeDefined();
      expect(json.label.name).toBe("Bug");
    });

    it("should return 404 for non-existent label", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.labels[":labelId"].$get(
        {
          param: { labelId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("POST /labels", () => {
    it("should create a new label", async () => {
      const { res, json } = await createLabel("Bug");

      expect(res.status).toBe(201);
      expect(json.label).toHaveProperty("id");
      expect(json.label.name).toBe("Bug");
      expect(json.label.colorKey).toBeDefined();
    });

    it("should return 400 when name is empty", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.labels.$post(
        {
          json: { name: "" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status as number).toBe(400);
    });

    it("should return 400 when name is too long", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.labels.$post(
        {
          json: { name: "A".repeat(51) },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status as number).toBe(400);
    });

    it("should return 400 when label with same name exists", async () => {
      await createLabel("Bug");

      const { client, headers } = getCtx();
      const res = await client.api.labels.$post(
        {
          json: { name: "Bug" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status as number).toBe(400);
    });
  });

  describe("DELETE /labels/:labelId", () => {
    it("should delete a label", async () => {
      const { json: createJson } = await createLabel("Bug");

      const { client, headers } = getCtx();
      const res = await client.api.labels[":labelId"].$delete(
        {
          param: { labelId: createJson.label.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);

      const getRes = await client.api.labels[":labelId"].$get(
        {
          param: { labelId: createJson.label.id },
        },
        {
          headers: headers(),
        },
      );

      expect(getRes.status).toBe(404);
    });

    it("should return 404 for non-existent label", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.labels[":labelId"].$delete(
        {
          param: { labelId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });
});
