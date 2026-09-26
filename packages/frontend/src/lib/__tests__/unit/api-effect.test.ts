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

type FetchHandler = (request: Request) => Response | Promise<Response>;
let handleFetch: FetchHandler = () => new Response("", { status: 500 });
let lastInit: RequestInit | undefined;

beforeAll(() => {
  (globalThis as any).window = windowStub;
  (globalThis as any).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    lastInit = init;
    return handleFetch(new Request(input, init));
  };
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("runApi", () => {
  beforeEach(() => {
    toastCalls.error.length = 0;
    windowStub.location.href = "http://app.local/dashboard";
  });

  it("calls the effect api with credentials and returns decoded data", async () => {
    const { runApi } = await import("../../api-effect");
    let url = "";
    handleFetch = (request) => {
      url = request.url;
      return json({ workspaces: [{ id: "1", displayName: "Acme", slug: "acme", logoUrl: null }] });
    };

    const { workspaces } = await runApi((client) => client.workspaces.list());

    expect(url).toBe("http://app.local/api/effect/workspaces");
    expect(lastInit?.credentials).toBe("include");
    expect(workspaces.map((workspace) => workspace.slug)).toEqual(["acme"]);
    expect(toastCalls.error).toEqual([]);
  });

  it("redirects to signin on Unauthorized", async () => {
    const { runApi } = await import("../../api-effect");
    handleFetch = () =>
      json({ _tag: "Unauthorized", code: "UNAUTHORIZED", message: "Unauthorized" }, 401);

    await expect(runApi((client) => client.workspaces.list())).rejects.toBeDefined();

    expect(windowStub.location.href).toBe("/signin");
    expect(toastCalls.error).toEqual([]);
  });

  it("shows the localized message for coded errors", async () => {
    const { runApi } = await import("../../api-effect");
    handleFetch = () =>
      json({ _tag: "WorkspaceNotFound", code: "WORKSPACE_NOT_FOUND", message: "nope" }, 404);

    await expect(
      runApi((client) => client.workspaces.getBySlug({ params: { slug: "gone" } })),
    ).rejects.toThrow("Workspace not found");

    expect(toastCalls.error).toEqual(["Workspace not found"]);
  });

  it("falls back to the generic message for unexpected responses", async () => {
    const { runApi } = await import("../../api-effect");
    handleFetch = () => new Response("", { status: 500 });

    await expect(runApi((client) => client.workspaces.list())).rejects.toThrow();

    expect(toastCalls.error).toHaveLength(1);
  });
});
