import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { AppError } from "./errors";

export const errorHandler = (err: Error | HTTPException, c: Context) => {
  if (process.env.NODE_ENV === "development") {
    console.log("=== Caught Error ===");
    console.error(err);
  }

  if (err instanceof AppError) {
    return c.text(err.message, err.statusCode);
  }

  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }

  if (err instanceof z.ZodError) {
    return c.text(z.prettifyError(err), 400);
  }

  console.error(err);
  return c.text("Something went wrong", 500);
};
