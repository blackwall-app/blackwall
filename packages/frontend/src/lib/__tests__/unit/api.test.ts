import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";

const toastCalls = {
  error: [] as string[],
};

mock.module("@/components/custom-ui/toast", () => ({
  toast: {
    error: (message: string) => {
      toastCalls.error.push(message);
    },
  },
}));

const windowStub = {
  __workspaceSlug: "acme",
  location: {
    origin: "http://app.local",
    href: "http://app.local/dashboard",
  },
};

beforeAll(() => {
  (globalThis as any).window = windowStub;
});

describe("apiFetch", () => {
  beforeEach(() => {
    toastCalls.error.length = 0;
    windowStub.location.href = "http://app.local/dashboard";
  });

  it("injects the workspace header and credentials on successful requests", async () => {
    const { apiFetch } = await import("../../api");

    let receivedInit: RequestInit | undefined;
    (globalThis as any).fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      receivedInit = init;
      return new Response("ok", { status: 200 });
    };

    const response = await apiFetch("http://api.local/issues", {
      headers: {
        "x-custom": "value",
      },
    });

    expect(response.status).toBe(200);
    expect((receivedInit?.headers as Headers).get("x-custom")).toBe("value");
    expect((receivedInit?.headers as Headers).get("x-blackwall-workspace-slug")).toBe("acme");
    expect(receivedInit?.credentials).toBe("include");
  });

  it("redirects to signin on 401 responses", async () => {
    const { apiFetch } = await import("../../api");

    (globalThis as any).fetch = async () => new Response("", { status: 401 });

    const response = await apiFetch("http://api.local/issues");

    expect(response.status).toBe(401);
    expect(windowStub.location.href).toBe("/signin");
  });

  it("shows an error toast and throws for non-401 errors with a response body", async () => {
    const { apiFetch } = await import("../../api");

    (globalThis as any).fetch = async () => new Response("Server exploded", { status: 500 });

    await expect(apiFetch("http://api.local/issues")).rejects.toThrow("Server exploded");
    expect(toastCalls.error).toEqual(["Server exploded"]);
  });
});
