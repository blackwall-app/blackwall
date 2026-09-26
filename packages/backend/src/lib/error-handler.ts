import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { Predicate, Schema, SchemaAST } from "effect";
import { ErrorCode } from "@blackwall/shared";
import { AppError } from "./errors";

const resolveStatus = SchemaAST.resolveAt<number>("httpApiStatus");

/**
 * Hono routes that run Effect services get their typed failures thrown as-is.
 * Every `ApiError` carries a `code`, and its schema carries the HTTP status.
 */
function apiErrorStatus(error: unknown): ContentfulStatusCode | undefined {
  if (!Predicate.hasProperty(error, "code") || !Schema.isSchema(error.constructor)) {
    return undefined;
  }
  return (resolveStatus(error.constructor.ast) ?? 500) as ContentfulStatusCode;
}

function isSqliteForeignKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_FOREIGNKEY"
  );
}

export const errorHandler = (err: Error | HTTPException, c: Context) => {
  if (process.env.NODE_ENV === "development") {
    console.log("=== Caught Error ===");
    console.error(err);
  }

  if (err instanceof AppError) {
    return c.json({ code: err.code, message: err.message }, err.statusCode);
  }

  const apiStatus = apiErrorStatus(err);
  if (apiStatus !== undefined && Predicate.hasProperty(err, "code")) {
    return c.json({ code: err.code, message: err.message }, apiStatus);
  }

  if (err instanceof HTTPException) {
    return c.json({ code: ErrorCode.HTTP_EXCEPTION, message: err.message }, err.status);
  }

  if (err instanceof z.ZodError) {
    return c.json({ code: ErrorCode.VALIDATION_ERROR, message: z.prettifyError(err) }, 400);
  }

  if (isSqliteForeignKeyError(err)) {
    return c.json({ code: ErrorCode.BAD_REQUEST, message: "Referenced entity not found" }, 400);
  }

  console.error(err);
  return c.json({ code: ErrorCode.INTERNAL_ERROR, message: "Something went wrong" }, 500);
};
