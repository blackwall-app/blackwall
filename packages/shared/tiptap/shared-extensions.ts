import { Image } from "@tiptap/extension-image";
import { StarterKit } from "@tiptap/starter-kit";

export const tiptapSharedExtensions = [
  StarterKit.configure({
    trailingNode: false,
  }),
  Image,
];
