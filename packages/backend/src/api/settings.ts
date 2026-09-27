import { Api, AvatarTooLarge, CurrentUser, CurrentWorkspace } from "@blackwall/shared";
import { Effect, Stream } from "effect";
import { HttpServerRequest, type Multipart } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { type AvatarUpload, ProfileService } from "../features/settings/ProfileService";
import { TeamService } from "../features/teams/TeamService";
import { WorkspaceService } from "../features/workspaces/WorkspaceService";

/** The `intent` field and the first file sent as `file`. */
const readAvatarForm = Effect.fnUntraced(
  function* (parts: Stream.Stream<Multipart.Part, Multipart.MultipartError>) {
    let intent: string | undefined;
    let file: AvatarUpload | undefined;
    yield* Stream.runForEach(parts, (part) => {
      if (part._tag === "Field" && part.key === "intent") {
        intent = part.value;
      } else if (part._tag === "File" && part.key === "file" && file === undefined) {
        return Effect.map(part.contentEffect, (bytes) => {
          file = { contentType: part.contentType, bytes };
        });
      }
      return Effect.void;
    });
    return { intent, file };
  },
  Effect.catchTag("MultipartError", (error) =>
    error.reason._tag === "FileTooLarge" ? Effect.fail(new AvatarTooLarge()) : Effect.die(error),
  ),
);

export const SettingsHandlers = HttpApiBuilder.group(
  Api,
  "settings",
  Effect.fn(function* (handlers) {
    const profiles = yield* ProfileService;
    const teams = yield* TeamService;
    const workspaces = yield* WorkspaceService;

    return handlers.handleAll({
      getProfile: () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          return { profile: yield* profiles.getProfile(user.id) };
        }),
      updateProfile: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          return { profile: yield* profiles.updateName({ userId: user.id, name: payload.name }) };
        }),
      updateAvatar: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const form = yield* readAvatarForm(payload);
          const profile =
            form.intent === "remove"
              ? yield* profiles.removeAvatar({ userId: user.id })
              : yield* profiles.setAvatar({ userId: user.id, file: form.file });
          return { profile };
        }),
      updateTheme: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* profiles.updatePreferredTheme({ userId: user.id, theme: payload.theme });
          return { theme: payload.theme };
        }),
      updateLocale: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          yield* profiles.updatePreferredLocale({ userId: user.id, locale: payload.locale });
          return { locale: payload.locale };
        }),
      changePassword: ({ payload }) =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          yield* profiles.changePassword({
            headers: request.headers,
            currentPassword: payload.currentPassword,
            newPassword: payload.newPassword,
            revokeOtherSessions: payload.revokeOtherSessions ?? false,
          });
          return { success: true };
        }),
      getWorkspace: () =>
        Effect.gen(function* () {
          return { workspace: yield* CurrentWorkspace };
        }),
      updateWorkspace: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          if (payload.displayName === undefined) {
            return { workspace };
          }
          return {
            workspace: yield* workspaces.updateWorkspace({
              actorId: user.id,
              workspaceId: workspace.id,
              displayName: payload.displayName,
            }),
          };
        }),
      listTeams: () =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          return { teams: yield* teams.listTeamsWithCounts({ workspaceId: workspace.id }) };
        }),
      createTeam: ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          const team = yield* teams.createTeamWithMember({
            workspaceId: workspace.id,
            name: payload.name,
            key: payload.key,
            userId: user.id,
          });
          return { team };
        }),
      getTeam: ({ params }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const { team, members } = yield* teams.getTeamWithMembers({
            workspaceId: workspace.id,
            teamKey: params.teamKey,
          });
          return { team, teamMembers: members };
        }),
      updateTeam: ({ params, payload }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const team = yield* teams.updateTeam({
            workspaceId: workspace.id,
            teamKey: params.teamKey,
            name: payload.name,
            key: payload.key,
          });
          return { team };
        }),
      listAvailableUsers: ({ params }) =>
        Effect.gen(function* () {
          const workspace = yield* CurrentWorkspace;
          const users = yield* teams.listAvailableUsers({
            workspaceId: workspace.id,
            teamKey: params.teamKey,
          });
          return { users };
        }),
      addTeamMember: ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          yield* teams.addMember({
            workspaceId: workspace.id,
            teamKey: params.teamKey,
            actorId: user.id,
            userId: payload.userId,
          });
          return { success: true };
        }),
      removeTeamMember: ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser;
          const workspace = yield* CurrentWorkspace;
          yield* teams.removeMember({
            workspaceId: workspace.id,
            teamKey: params.teamKey,
            actorId: user.id,
            userId: params.userId,
          });
          return { success: true };
        }),
    });
  }),
);
