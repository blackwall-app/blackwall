import { RequestValidation, ValidationError } from "@blackwall/shared";
import { Effect } from "effect";
import { HttpApiMiddleware } from "effect/unstable/httpapi";

/**
 * Bad input becomes a `ValidationError` with the schema's message. A response
 * that fails to encode is a server bug, so it stays a defect and returns 500.
 */
export const RequestValidationLive = HttpApiMiddleware.layerSchemaErrorTransform(
  RequestValidation,
  (error) =>
    error.kind === "Body" || error.kind === "ResponseHeaders"
      ? Effect.die(error.cause)
      : Effect.fail(new ValidationError({ message: error.cause.message })),
);
