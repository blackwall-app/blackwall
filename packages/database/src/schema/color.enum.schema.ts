import { possibleColors } from "@blackwall/shared";
import { text } from "drizzle-orm/sqlite-core";

export type ColorKey = (typeof possibleColors)[number];

export const colorKey = () => text().$type<ColorKey>();
