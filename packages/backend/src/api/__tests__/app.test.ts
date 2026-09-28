import "../../test/env.test";
import { describe, expect, test } from "bun:test";
import { handleRequest } from "../../index";
import { env } from "../../lib/env";

const get = (path: string) => handleRequest(new Request(`${env.APP_BASE_URL}${path}`));

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

  test("sets security headers on error responses", async () => {
    const response = await get("/api/workspaces");

    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  test("answers CORS preflights for the app origin", async () => {
    const response = await handleRequest(
      new Request(`${env.APP_BASE_URL}/api/workspaces`, {
        method: "OPTIONS",
        headers: { origin: env.APP_BASE_URL, "access-control-request-method": "POST" },
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(env.APP_BASE_URL);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "x-blackwall-workspace-slug",
    );
  });

  describe("csrf", () => {
    const postForm = (headers: Record<string, string>) =>
      handleRequest(
        new Request(`${env.APP_BASE_URL}/api/better-auth/sign-out`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
          body: "",
        }),
      );

    test("rejects form posts from another origin", async () => {
      const response = await postForm({ origin: "https://evil.example" });

      expect(response.status).toBe(403);
    });

    test("rejects form posts without an origin", async () => {
      const response = await postForm({});

      expect(response.status).toBe(403);
    });

    test("allows form posts from the app origin", async () => {
      const response = await postForm({ origin: env.APP_BASE_URL });

      expect(response.status).not.toBe(403);
    });

    test("allows same-origin form posts by Sec-Fetch-Site", async () => {
      const response = await postForm({ "sec-fetch-site": "same-origin" });

      expect(response.status).not.toBe(403);
    });

    test("leaves JSON requests to CORS", async () => {
      const response = await handleRequest(
        new Request(`${env.APP_BASE_URL}/api/workspaces`, {
          method: "POST",
          headers: { "content-type": "application/json", origin: "https://evil.example" },
          body: "{}",
        }),
      );

      expect(response.status).toBe(401);
    });
  });
});
