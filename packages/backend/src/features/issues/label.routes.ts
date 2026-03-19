import { Hono } from "hono";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod";
import { labelService } from "./label.service";
import type { AppEnv } from "../../lib/hono-env";
import { authMiddleware } from "../auth/auth-middleware";
import { workspaceMiddleware } from "../workspaces/workspace-middleware";
import { createLabelSchema, labelListSchema, labelSchema } from "./label.zod";
import { HTTPException } from "hono/http-exception";

const labelRoutes = new Hono<AppEnv>()
  .use("*", authMiddleware)
  .use("*", workspaceMiddleware)
  .get(
    "/",
    describeRoute({
      tags: ["Labels"],
      summary: "List all labels",
      responses: {
        200: {
          description: "List of labels",
          content: { "application/json": { schema: resolver(labelListSchema) } },
        },
      },
    }),
    async (c) => {
      const workspace = c.get("workspace");
      const labels = await labelService.getLabelsForWorkspace({
        workspaceId: workspace.id,
      });

      return c.json({ labels });
    },
  )
  .get(
    "/:labelId",
    describeRoute({
      tags: ["Labels"],
      summary: "Get a label by id",
      responses: {
        200: {
          description: "Label details",
          content: { "application/json": { schema: resolver(z.object({ label: labelSchema })) } },
        },
        404: { description: "Label not found" },
      },
    }),
    validator("param", z.object({ labelId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const { labelId } = c.req.valid("param");

      const label = await labelService.getLabelById({
        labelId,
        workspaceId: workspace.id,
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      return c.json({ label });
    },
  )
  .post(
    "/",
    describeRoute({
      tags: ["Labels"],
      summary: "Create a new label",
      responses: {
        201: {
          description: "Created label",
          content: { "application/json": { schema: resolver(z.object({ label: labelSchema })) } },
        },
        400: { description: "Label already exists" },
      },
    }),
    validator("json", createLabelSchema),
    async (c) => {
      const workspace = c.get("workspace");
      const { name } = c.req.valid("json");

      try {
        const label = await labelService.createLabel({
          name,
          workspaceId: workspace.id,
        });

        return c.json({ label }, 201);
      } catch (error) {
        if (error instanceof Error && error.message === "Label with this name already exists") {
          throw new HTTPException(400, { message: error.message });
        }
        throw error;
      }
    },
  )
  .delete(
    "/:labelId",
    describeRoute({
      tags: ["Labels"],
      summary: "Delete a label",
      responses: {
        200: {
          description: "Label deleted",
          content: { "application/json": { schema: resolver(z.object({ success: z.boolean() })) } },
        },
        404: { description: "Label not found" },
      },
    }),
    validator("param", z.object({ labelId: z.string() })),
    async (c) => {
      const workspace = c.get("workspace");
      const { labelId } = c.req.valid("param");

      try {
        await labelService.deleteLabel({
          labelId,
          workspaceId: workspace.id,
        });

        return c.json({ success: true });
      } catch (error) {
        if (error instanceof Error && error.message === "Label not found") {
          throw new HTTPException(404, { message: error.message });
        }
        throw error;
      }
    },
  );

export { labelRoutes };
