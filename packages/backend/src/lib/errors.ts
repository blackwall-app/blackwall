import { ErrorCode } from "@blackwall/shared";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  public readonly statusCode: ContentfulStatusCode;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: ContentfulStatusCode = 500,
    code: string = ErrorCode.INTERNAL_ERROR,
    isOperational = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found", code: string = ErrorCode.NOT_FOUND) {
    super(message, 404, code);
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Bad request", code: string = ErrorCode.BAD_REQUEST) {
    super(message, 400, code);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized", code: string = ErrorCode.UNAUTHORIZED) {
    super(message, 401, code);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden", code: string = ErrorCode.FORBIDDEN) {
    super(message, 403, code);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code: string = ErrorCode.CONFLICT) {
    super(message, 409, code);
  }
}
