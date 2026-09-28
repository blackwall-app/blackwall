import { Api, Authorization, WORKSPACE_SLUG_HEADER, WorkspaceMembership } from "@blackwall/shared";
import { Cause, Context, Effect, Exit, Layer, ManagedRuntime, Predicate } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { HttpApiClient, HttpApiMiddleware } from "effect/unstable/httpapi";
import { toast } from "@/components/custom-ui/toast";
import { localizeErrorCode } from "@/lib/error-localization";
import { backendUrl } from "./env";

// The browser attaches the session cookie itself because of `credentials: "include"`.
const AuthorizationClient = HttpApiMiddleware.layerClient(Authorization, ({ next, request }) =>
  next(request),
);

const WorkspaceMembershipClient = HttpApiMiddleware.layerClient(
  WorkspaceMembership,
  ({ next, request }) =>
    next(
      window.__workspaceSlug
        ? HttpClientRequest.setHeader(request, WORKSPACE_SLUG_HEADER, window.__workspaceSlug)
        : request,
    ),
);

export class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api>>()(
  "blackwall/ApiClient",
) {
  static readonly layer = Layer.effect(
    ApiClient,
    HttpApiClient.make(Api, {
      transformClient: HttpClient.mapRequest(HttpClientRequest.prependUrl(`${backendUrl}/api`)),
    }),
  ).pipe(
    Layer.provide([AuthorizationClient, WorkspaceMembershipClient]),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "include" })),
  );
}

const runtime = ManagedRuntime.make(ApiClient.layer);

/**
 * Handles a failed call: a 401 sends the user to
 * `/signin`, anything else shows a localized toast and rejects with the
 * message. API errors carry a `code`; transport and decoding failures fall
 * back to the generic message.
 */
const reportFailure = (cause: Cause.Cause<unknown>): never => {
  const error = Cause.squash(cause);
  if (Predicate.isTagged(error, "Unauthorized")) {
    window.location.href = "/signin";
    throw error;
  }

  const code =
    Predicate.hasProperty(error, "code") && Predicate.isString(error.code) ? error.code : undefined;
  const message =
    code !== undefined &&
    Predicate.hasProperty(error, "message") &&
    Predicate.isString(error.message)
      ? error.message
      : undefined;
  const displayMessage = localizeErrorCode(code, message);
  console.error(code ?? "UNKNOWN", error);
  toast.error(displayMessage);
  throw new Error(displayMessage);
};

/**
 * Calls the Effect API from loaders and actions. Components never see Effect:
 *
 * ```ts
 * const { workspace } = await runApi((client) =>
 *   client.workspaces.getBySlug({ params: { slug } }),
 * );
 * ```
 */
export const runApi = async <A, E>(
  f: (client: ApiClient["Service"]) => Effect.Effect<A, E>,
): Promise<A> => {
  const exit = await runtime.runPromiseExit(ApiClient.use(f));
  return Exit.isSuccess(exit) ? exit.value : reportFailure(exit.cause);
};
