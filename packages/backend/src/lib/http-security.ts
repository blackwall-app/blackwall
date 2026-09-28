import { Effect, Layer } from "effect";
import {
  HttpEffect,
  HttpMiddleware,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http";
import { env } from "./env";

/** The defaults of Hono's `secureHeaders`, which this app used before. */
const securityHeaders = {
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-dns-prefetch-control": "off",
  "x-download-options": "noopen",
  "x-frame-options": "SAMEORIGIN",
  "x-permitted-cross-domain-policies": "none",
  "x-xss-protection": "0",
};

/** A pre-response handler, so error and not-found responses get the headers too. */
const SecurityHeaders = HttpRouter.middleware(
  (httpApp) =>
    Effect.andThen(
      HttpEffect.appendPreResponseHandler((_request, response) =>
        Effect.succeed(HttpServerResponse.setHeaders(response, securityHeaders)),
      ),
      httpApp,
    ),
  { global: true },
);

const formContentType =
  /^\b(application\/x-www-form-urlencoded|multipart\/form-data|text\/plain)\b/i;

/**
 * Rejects unsafe requests a cross-site HTML form could send, the same check as
 * Hono's `csrf`. JSON requests are left alone, since browsers preflight them
 * and CORS blocks foreign origins.
 */
const isCrossSiteForm = (request: HttpServerRequest.HttpServerRequest) =>
  request.method !== "GET" &&
  request.method !== "HEAD" &&
  formContentType.test(request.headers["content-type"] ?? "text/plain") &&
  request.headers["sec-fetch-site"] !== "same-origin" &&
  request.headers["origin"] !== env.APP_BASE_URL;

const Csrf = HttpRouter.middleware(
  (httpApp) =>
    Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
      isCrossSiteForm(request)
        ? Effect.succeed(HttpServerResponse.text("Forbidden", { status: 403 }))
        : httpApp,
    ),
  { global: true },
);

const Cors = HttpRouter.middleware(
  HttpMiddleware.cors({
    allowedOrigins: [env.APP_BASE_URL],
    allowedHeaders: ["Content-Type", "Authorization", "x-blackwall-workspace-slug"],
    allowedMethods: ["POST", "GET", "OPTIONS", "DELETE", "PATCH"],
    exposedHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  }),
  { global: true },
);

/** Security headers, CSRF and CORS for every route on the router. */
export const HttpSecurityLive = Layer.mergeAll(SecurityHeaders, Csrf, Cors);
