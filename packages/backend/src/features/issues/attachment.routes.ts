import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { attachmentService } from "./attachment.service";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import {
  attachmentParamsSchema,
  attachmentUploadFormSchema,
  associateAttachmentsSchema,
  deleteAttachmentParamsSchema,
  getAttachmentParamsSchema,
  attachmentResponseSchema,
} from "./attachment.zod";
import { BadRequestError } from "../../lib/errors";
import { getFile } from "../../lib/file-upload";
import { HTTPException } from "hono/http-exception";

const attachmentRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  /**
   * POST /:issueKey/attachments - Upload an attachment to an issue.
   */
  .post(
    "/:issueKey/attachments",
    describeRoute({
      tags: ["Attachments"],
      summary: "Upload attachment to issue",
      responses: {
        200: {
          description: "Uploaded attachment",
          content: { "application/json": { schema: resolver(attachmentResponseSchema) } },
        },
      },
    }),
    validator("param", attachmentParamsSchema),
    validator("form", attachmentUploadFormSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");
      const { file } = c.req.valid("form");

      const attachment = await attachmentService.uploadAttachment({
        workspaceSlug: workspace.slug,
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
        file,
      });

      return c.json({ attachment });
    },
  )
  /**
   * POST /attachments - Upload an orphan attachment (not linked to any issue yet).
   */
  .post(
    "/attachments",
    describeRoute({
      tags: ["Attachments"],
      summary: "Upload orphan attachment",
      responses: {
        200: {
          description: "Uploaded attachment",
          content: { "application/json": { schema: resolver(attachmentResponseSchema) } },
        },
      },
    }),
    validator("form", attachmentUploadFormSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const body = await c.req.parseBody();
      const file = body["file"];

      if (!(file instanceof File)) {
        throw new BadRequestError("File is missing or invalid");
      }

      const attachment = await attachmentService.uploadAttachment({
        workspaceSlug: workspace.slug,
        workspaceId: workspace.id,
        issueKey: null,
        userId: user.id,
        file,
      });

      return c.json({ attachment });
    },
  )
  /**
   * POST /:issueKey/attachments/associate - Associate orphan attachments with an issue.
   */
  .post(
    "/:issueKey/attachments/associate",
    describeRoute({
      tags: ["Attachments"],
      summary: "Associate attachments with issue",
      responses: {
        200: {
          description: "Success",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
      },
    }),
    validator("param", attachmentParamsSchema),
    validator("json", associateAttachmentsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey } = c.req.valid("param");
      const { attachmentIds } = c.req.valid("json");

      await attachmentService.associateAttachments({
        workspaceId: workspace.id,
        issueKey,
        userId: user.id,
        attachmentIds,
      });

      return c.json({ success: true });
    },
  )
  /**
   * GET /:issueKey/attachments/:attachmentId - Get an attachment by its id.
   */
  .get(
    "/:issueKey/attachments/:attachmentId",
    describeRoute({
      tags: ["Attachments"],
      summary: "Get attachment details",
      responses: {
        200: {
          description: "Attachment details",
          content: { "application/json": { schema: resolver(attachmentResponseSchema) } },
        },
      },
    }),
    validator("param", deleteAttachmentParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const { issueKey, attachmentId } = c.req.valid("param");

      const attachment = await attachmentService.getAttachment({
        workspaceId: workspace.id,
        issueKey,
        attachmentId,
      });

      return c.json({ attachment });
    },
  )
  /**
   * DELETE /:issueKey/attachments/:attachmentId - Delete an attachment from an issue.
   */
  .delete(
    "/:issueKey/attachments/:attachmentId",
    describeRoute({
      tags: ["Attachments"],
      summary: "Delete attachment",
      responses: {
        200: {
          description: "Success message",
          content: { "application/json": { schema: resolver(z.object({ message: z.string() })) } },
        },
      },
    }),
    validator("param", deleteAttachmentParamsSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const user = c.get("user")!;
      const { issueKey, attachmentId } = c.req.valid("param");

      await attachmentService.deleteAttachment({
        workspaceId: workspace.id,
        issueKey,
        attachmentId,
        userId: user.id,
      });

      return c.json({ message: "Attachment deleted" });
    },
  );

/**
 * GET /attachments/:attachmentId/download - Download attachment file.
 */
const attachmentDownloadRoutes = new Hono<AppEnv>().use("*", authMiddleware).get(
  "/attachments/:attachmentId/download",
  describeRoute({
    tags: ["Attachments"],
    summary: "Download attachment",
    responses: {
      200: {
        description: "Attachment content",
        content: { "*/*": { schema: resolver(z.any()) } },
      },
    },
  }),
  validator("param", getAttachmentParamsSchema),
  async (c) => {
    const user = c.get("user")!;
    const { attachmentId } = c.req.valid("param");

    const attachment = await attachmentService.getAttachmentForDownload({
      userId: user.id,
      attachmentId,
    });

    const { file, exists } = await getFile(attachment.filePath);
    if (!exists) {
      throw new HTTPException(404, { message: "Attachment file not found" });
    }

    return c.newResponse(file.stream(), 200, {
      "content-type": attachment.mimeType || "application/octet-stream",
      "content-disposition": `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`,
    });
  },
);

export { attachmentRoutes, attachmentDownloadRoutes };
