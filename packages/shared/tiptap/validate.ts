import { getSchema } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { tiptapSharedExtensions } from "./shared-extensions";

export function validateTiptapContent(content: unknown): boolean {
  const schema = getSchema(tiptapSharedExtensions);
  try {
    const json =
      typeof content === "string"
        ? (JSON.parse(content) as Parameters<typeof Node.fromJSON>[1])
        : (content as Parameters<typeof Node.fromJSON>[1]);
    Node.fromJSON(schema, json);
    return true;
  } catch {
    return false;
  }
}
