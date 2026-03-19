import { getSchema } from "@tiptap/core";
import { tiptapSharedExtensions } from "./shared-extensions";

export function validateTiptapContent(content: string) {
  const schema = getSchema(tiptapSharedExtensions);
}
