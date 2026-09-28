import "../../test/env.test";
import { describe, expect, test } from "bun:test";
import { app } from "../../index";
import { env } from "../../lib/env";

const get = (path: string) => app.fetch(new Request(`${env.APP_BASE_URL}${path}`));

describe("app shell", () => {
  test("serves the OpenAPI spec under /api", async () => {
    const response = await get("/api/openapi.json");

    expect(response.status).toBe(200);
    const spec = (await response.json()) as {
      servers: Array<{ url: string }>;
      paths: Record<string, unknown>;
    };
    expect(spec.servers).toEqual([{ url: "/api" }]);
    expect(spec.paths["/workspaces"]).toBeDefined();
  });

  test("serves the Scalar docs under /api", async () => {
    const response = await get("/api/docs");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  });

  test("routes API requests to the HttpApi", async () => {
    const response = await get("/api/workspaces");

    expect(response.status).toBe(401);
  });
});
