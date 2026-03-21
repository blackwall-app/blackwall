import type { JSONContent } from "@tiptap/core";
import { z } from "zod";
import { validateTiptapContent } from "./validate";

export const tiptapDocumentSchema = z.custom<JSONContent>(
  (data) => validateTiptapContent(data),
  "Invalid TipTap document",
);
