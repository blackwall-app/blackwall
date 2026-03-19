import "../../../../test/env.test";
import { describe, it, expect, afterEach } from "bun:test";
import { rmSync } from "node:fs";
import { useTestContext } from "../../../../test/context";
import { env } from "../../../../lib/zod-env";

describe("Attachment Routes", () => {
  const getCtx = useTestContext();

  afterEach(() => {
    const { workspace } = getCtx();
    try {
      rmSync(`${env.FILES_DIR}/workspaces/${workspace.slug}`, { recursive: true, force: true });
    } catch {
      // Directory may not exist
    }
  });

  const createIssue = async () => {
    const { client, headers, team } = getCtx();
    const res = await client.api.issues.$post(
      {
        json: {
          teamKey: team.key,
          issue: {
            summary: "Test Issue",
            description: {},
            status: "to_do",
            assignedToId: null,
            sprintId: null,
          },
        },
      },
      {
        headers: headers(),
      },
    );
    const json = await res.json();
    return json.issue;
  };

  const createTestFile = (name = "test.png", type = "image/png") => {
    const content = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    return new File([content], name, { type });
  };

  const createFormHeaders = () => {
    const { sessionCookie, workspace } = getCtx();
    return {
      Cookie: sessionCookie,
      "x-blackwall-workspace-slug": workspace.slug,
    };
  };

  const uploadAttachment = async (issueKey: string, file?: File) => {
    const { client } = getCtx();
    return client.api.issues[":issueKey"].attachments.$post(
      {
        param: { issueKey },
        form: { file: file ?? createTestFile() },
      },
      {
        headers: createFormHeaders(),
      },
    );
  };

  const uploadOrphanAttachment = async (file?: File) => {
    const { client } = getCtx();
    return client.api.issues.attachments.$post(
      {
        form: { file: file ?? createTestFile() },
      },
      {
        headers: createFormHeaders(),
      },
    );
  };

  describe("POST /issues/:issueKey/attachments", () => {
    it("should upload an attachment to an issue", async () => {
      const issue = await createIssue();
      const res = await uploadAttachment(issue.key);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.attachment).toHaveProperty("id");
      expect(json.attachment.issueId).toBe(issue.id);
      expect(json.attachment.originalFileName).toBe("test.png");
      expect(json.attachment.mimeType).toBe("image/png");
    });

    it("should return 404 for non-existent issue", async () => {
      const res = await uploadAttachment("NONEXISTENT-999");

      expect(res.status).toBe(404);
    });
  });

  describe("POST /issues/attachments", () => {
    it("should upload an orphan attachment", async () => {
      const res = await uploadOrphanAttachment();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.attachment).toHaveProperty("id");
      expect(json.attachment.issueId).toBeNull();
      expect(json.attachment.originalFileName).toBe("test.png");
    });
  });

  describe("POST /issues/:issueKey/attachments/associate", () => {
    it("should associate orphan attachments with an issue", async () => {
      const issue = await createIssue();

      // Upload orphan attachment
      const orphanRes = await uploadOrphanAttachment();
      const orphanJson = (await orphanRes.json()) as { attachment: { id: string } };

      // Associate with issue
      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].attachments.associate.$post(
        {
          param: { issueKey: issue.key },
          json: { attachmentIds: [orphanJson.attachment.id] },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it("should return 404 for non-existent issue", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].attachments.associate.$post(
        {
          param: { issueKey: "NONEXISTENT-999" },
          json: { attachmentIds: ["00000000-0000-0000-0000-000000000000"] },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /issues/:issueKey/attachments/:attachmentId", () => {
    it("should get an attachment", async () => {
      const issue = await createIssue();
      const uploadRes = await uploadAttachment(issue.key);
      const uploadJson = (await uploadRes.json()) as { attachment: { id: string } };

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].attachments[":attachmentId"].$get(
        {
          param: { issueKey: issue.key, attachmentId: uploadJson.attachment.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.attachment.id).toBe(uploadJson.attachment.id);
    });

    it("should return 404 for non-existent attachment", async () => {
      const issue = await createIssue();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].attachments[":attachmentId"].$get(
        {
          param: { issueKey: issue.key, attachmentId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /issues/:issueKey/attachments/:attachmentId", () => {
    it("should delete an attachment", async () => {
      const issue = await createIssue();
      const uploadRes = await uploadAttachment(issue.key);
      const uploadJson = (await uploadRes.json()) as { attachment: { id: string } };

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].attachments[":attachmentId"].$delete(
        {
          param: { issueKey: issue.key, attachmentId: uploadJson.attachment.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("Attachment deleted");
    });

    it("should return 404 for non-existent attachment", async () => {
      const issue = await createIssue();

      const { client, headers } = getCtx();
      const res = await client.api.issues[":issueKey"].attachments[":attachmentId"].$delete(
        {
          param: { issueKey: issue.key, attachmentId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /issues/attachments/:attachmentId/download", () => {
    it("should get attachment for download", async () => {
      const issue = await createIssue();
      const uploadRes = await uploadAttachment(issue.key);
      const uploadJson = (await uploadRes.json()) as { attachment: { id: string } };

      const { client, headers } = getCtx();
      const res = await client.api.issues.attachments[":attachmentId"].download.$get(
        {
          param: { attachmentId: uploadJson.attachment.id },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/png");
      expect(res.headers.get("content-disposition")).toContain("inline");
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47]);
    });

    it("should return 404 for non-existent attachment", async () => {
      const { client, headers } = getCtx();
      const res = await client.api.issues.attachments[":attachmentId"].download.$get(
        {
          param: { attachmentId: "00000000-0000-0000-0000-000000000000" },
        },
        {
          headers: headers(),
        },
      );

      expect(res.status).toBe(404);
    });
  });
});
