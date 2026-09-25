type TiptapNode = {
  text?: unknown;
  content?: unknown;
};

/**
 * Collects the text of every text node in a TipTap document, separated by single spaces.
 * Node types, marks and attributes are ignored, so searching "paragraph" doesn't match
 * every document.
 */
export function tiptapToPlainText(document: unknown): string {
  const parts: string[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const { text, content } = node as TiptapNode;
    if (typeof text === "string" && text.length > 0) parts.push(text);
    if (Array.isArray(content)) content.forEach(visit);
  };

  visit(document);
  return parts.join(" ");
}
