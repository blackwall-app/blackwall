import { Database } from "@blackwall/database/effect";
import type { Team, User, Workspace as WorkspaceRow } from "@blackwall/database/schema";
import { NotWorkspaceMember, WorkspaceNotFound, WorkspaceSlugTaken } from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { teamData } from "../teams/team.data";
import { teamKeyFromName } from "../teams/team.service";
import { isSqliteUniqueConstraintError } from "../../lib/errors";
import { workspaceData } from "./workspace.data";

export class WorkspaceService extends Context.Service<
  WorkspaceService,
  {
    readonly createWorkspace: (input: {
      displayName: string;
      slug: string;
      ownerId: string;
    }) => Effect.Effect<{ team: Team; workspace: WorkspaceRow }, WorkspaceSlugTaken>;
    readonly requireWorkspace: (
      slug: string,
      userId: string,
    ) => Effect.Effect<WorkspaceRow, WorkspaceNotFound | NotWorkspaceMember>;
    readonly isWorkspaceMember: (input: {
      userId: string;
      workspaceId: string;
    }) => Effect.Effect<boolean, never>;
    readonly listUserWorkspaces: (input: {
      userId: string;
    }) => Effect.Effect<Array<WorkspaceRow>, never>;
    readonly updateWorkspace: (input: {
      actorId: string;
      workspaceId: string;
      displayName: string;
    }) => Effect.Effect<WorkspaceRow | undefined, NotWorkspaceMember>;
    readonly getPreferredWorkspaceForUser: (input: {
      user: Pick<User, "lastWorkspaceId" | "id">;
    }) => Effect.Effect<WorkspaceRow | null, never>;
    readonly saveLastWorkspaceForUser: (input: {
      userId: string;
      workspaceId: string;
    }) => Effect.Effect<void, never>;
  }
>()("blackwall/WorkspaceService") {
  static readonly layer = Layer.effect(
    WorkspaceService,
    Effect.gen(function* () {
      const { db } = yield* Database;

      const createWorkspace = Effect.fn("WorkspaceService.createWorkspace")(function* (input: {
        displayName: string;
        slug: string;
        ownerId: string;
      }) {
        return yield* Effect.try({
          try: () =>
            db.transaction((tx) => {
              const workspace = workspaceData.insertWorkspace(tx, {
                displayName: input.displayName,
                slug: input.slug,
              });
              workspaceData.insertWorkspaceMember(tx, {
                role: "owner",
                userId: input.ownerId,
                workspaceId: workspace.id,
              });
              const team = teamData.insertTeam(tx, {
                key: teamKeyFromName(input.displayName),
                name: input.displayName,
                workspaceId: workspace.id,
              });
              teamData.insertTeamMember(tx, { teamId: team.id, userId: input.ownerId });
              return { team, workspace };
            }),
          catch: (cause) => cause,
        }).pipe(
          // Every other row in the transaction belongs to the new workspace, so a
          // unique violation can only come from the slug.
          Effect.catch((cause) =>
            isSqliteUniqueConstraintError(cause)
              ? Effect.fail(new WorkspaceSlugTaken({ message: "Workspace slug is already taken" }))
              : Effect.die(cause),
          ),
        );
      });

      const requireWorkspace = Effect.fn("WorkspaceService.requireWorkspace")(function* (
        slug: string,
        userId: string,
      ) {
        const workspace = yield* Effect.promise(() => workspaceData.getWorkspaceBySlug(slug, db));
        if (workspace === undefined) {
          return yield* new WorkspaceNotFound({
            message: "Workspace not found",
          });
        }
        const member = yield* Effect.promise(() =>
          workspaceData.isWorkspaceMember({ userId, workspaceId: workspace.id }, db),
        );
        if (!member) {
          return yield* new NotWorkspaceMember({
            message: "Current user is not a member of the workspace",
          });
        }
        return workspace;
      });

      const isWorkspaceMember = Effect.fn("WorkspaceService.isWorkspaceMember")(function* (input: {
        userId: string;
        workspaceId: string;
      }) {
        return yield* Effect.promise(() => workspaceData.isWorkspaceMember(input, db));
      });

      const listUserWorkspaces = Effect.fn("WorkspaceService.listUserWorkspaces")(
        function* (input: { userId: string }) {
          return yield* Effect.promise(() => workspaceData.listUserWorkspaces(input, db));
        },
      );

      const updateWorkspace = Effect.fn("WorkspaceService.updateWorkspace")(function* (input: {
        actorId: string;
        workspaceId: string;
        displayName: string;
      }) {
        const member = yield* Effect.promise(() =>
          workspaceData.isWorkspaceMember(
            { userId: input.actorId, workspaceId: input.workspaceId },
            db,
          ),
        );
        if (!member) {
          return yield* new NotWorkspaceMember({
            message: "Current user is not a member of the workspace",
          });
        }
        return yield* Effect.promise(() =>
          workspaceData.updateWorkspace(
            {
              displayName: input.displayName,
              workspaceId: input.workspaceId,
            },
            db,
          ),
        );
      });

      const getPreferredWorkspaceForUser = Effect.fn(
        "WorkspaceService.getPreferredWorkspaceForUser",
      )(function* (input: { user: Pick<User, "lastWorkspaceId" | "id"> }) {
        if (input.user.lastWorkspaceId) {
          const workspace = yield* Effect.promise(() =>
            workspaceData.getWorkspaceById(input.user.lastWorkspaceId!, db),
          );
          if (workspace !== undefined) {
            return workspace;
          }
        }
        const workspace = yield* Effect.promise(() =>
          workspaceData.getFirstWorkspaceForUser({ userId: input.user.id }, db),
        );
        return workspace ?? null;
      });

      const saveLastWorkspaceForUser = Effect.fn("WorkspaceService.saveLastWorkspaceForUser")(
        function* (input: { userId: string; workspaceId: string }) {
          yield* Effect.promise(() => workspaceData.saveLastWorkspaceForUser(input, db));
        },
      );

      return WorkspaceService.of({
        createWorkspace,
        requireWorkspace,
        isWorkspaceMember,
        listUserWorkspaces,
        updateWorkspace,
        getPreferredWorkspaceForUser,
        saveLastWorkspaceForUser,
      });
    }),
  );
}

export type WorkspaceServiceShape = WorkspaceService["Service"];
