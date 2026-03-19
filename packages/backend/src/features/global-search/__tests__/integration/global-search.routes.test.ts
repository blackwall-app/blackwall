import "../../../../test/env.test";
import { describe, it, expect } from "bun:test";
import { useTestContext } from "../../../../test/context";

describe("Global Search Routes", () => {
  const getCtx = useTestContext();

  describe("GET /search", () => {
    it("should return empty results for no matches", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.search.$get(
        { query: { q: "nonexistentterm12345" } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.issues).toEqual([]);
      expect(json.users).toEqual([]);
    });

    it("should return 400 when query is missing", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.search.$get({ query: {} as any }, { headers: headers() });

      expect(res.status).toBe(400);
    });

    it("should find users by name", async () => {
      const { client, headers, user } = getCtx();
      const searchTerm = user.name.substring(0, 4);
      const res = await client.api.search.$get(
        { query: { q: searchTerm } },
        { headers: headers() },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.users.length).toBeGreaterThanOrEqual(1);
      expect(json.users.some((u) => u.id === user.id)).toBe(true);
    });
  });
});
