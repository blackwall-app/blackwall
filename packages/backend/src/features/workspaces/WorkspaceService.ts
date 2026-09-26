import { Database } from "@blackwall/database/effect";
import type { Team, User, Workspace as WorkspaceRow } from "@blackwall/database/schema";
import {
  MemberNotFound,
  NotWorkspaceMember,
  WorkspaceNotFound,
  WorkspaceSlugTaken,
} from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { teamData } from "../teams/team.data";
import { teamKeyFromName } from "../teams/team.service";
import { workspaceData } from "./workspace.data";

type WorkspaceMemberRow = NonNullable<Awaited<ReturnType<typeof workspaceData.getWorkspaceMember>>>;

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
    }) => Effect.Effect<boolean>;
    readonly listUserWorkspaces: (input: { userId: string }) => Effect.Effect<Array<WorkspaceRow>>;
    readonly updateWorkspace: (input: {
      actorId: string;
      workspaceId: string;
      displayName: string;
    }) => Effect.Effect<WorkspaceRow, WorkspaceNotFound | NotWorkspaceMember>;
    readonly listMembers: (input: {
      slug: string;
      actorId: string;
    }) => Effect.Effect<Array<WorkspaceMemberRow>, WorkspaceNotFound | NotWorkspaceMember>;
    readonly getMember: (input: {
      slug: string;
      actorId: string;
      userId: string;
    }) => Effect.Effect<
      WorkspaceMemberRow,
      WorkspaceNotFound | NotWorkspaceMember | MemberNotFound
    >;
    readonly getPreferredWorkspaceForUser: (input: {
      user: Pick<User, "lastWorkspaceId" | "id">;
    }) => Effect.Effect<WorkspaceRow | null>;
    readonly saveLastWorkspaceForUser: (input: {
      userId: string;
      workspaceId: string;
    }) => Effect.Effect<void>;
  }
>()("blackwall/WorkspaceService") {
  static readonly layer = Layer.effect(
    WorkspaceService,
    Effect.gen(function* () {
      const database = yield* Database;

      const createWorkspace = Effect.fn("WorkspaceService.createWorkspace")(function* (input: {
        displayName: string;
        slug: string;
        ownerId: string;
      }) {
        return yield* database
          .transaction((tx) => {
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
          })
          .pipe(
            // Every other row in the transaction belongs to the new workspace, so a
            // unique violation can only come from the slug.
            Effect.catchTag("DatabaseError", (error) =>
              error.isUniqueViolation ? Effect.fail(new WorkspaceSlugTaken()) : Effect.die(error),
            ),
          );
      });

      const isWorkspaceMember = Effect.fn("WorkspaceService.isWorkspaceMember")(function* (input: {
        userId: string;
        workspaceId: string;
      }) {
        return yield* database.use((db) => workspaceData.isWorkspaceMember(input, db));
      }, Effect.orDie);

      const requireMember = Effect.fn("WorkspaceService.requireMember")(function* (input: {
        userId: string;
        workspaceId: string;
      }) {
        if (!(yield* isWorkspaceMember(input))) {
          return yield* new NotWorkspaceMember();
        }
      });

      const requireWorkspace = Effect.fn("WorkspaceService.requireWorkspace")(
        function* (slug: string, userId: string) {
          const workspace = yield* database.use((db) => workspaceData.getWorkspaceBySlug(slug, db));
          if (workspace === undefined) {
            return yield* new WorkspaceNotFound();
          }
          yield* requireMember({ userId, workspaceId: workspace.id });
          return workspace;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listUserWorkspaces = Effect.fn("WorkspaceService.listUserWorkspaces")(
        function* (input: { userId: string }) {
          return yield* database.use((db) => workspaceData.listUserWorkspaces(input, db));
        },
        Effect.orDie,
      );

      const updateWorkspace = Effect.fn("WorkspaceService.updateWorkspace")(
        function* (input: { actorId: string; workspaceId: string; displayName: string }) {
          yield* requireMember({ userId: input.actorId, workspaceId: input.workspaceId });
          const workspace = yield* database.use((db) =>
            workspaceData.updateWorkspace(
              { displayName: input.displayName, workspaceId: input.workspaceId },
              db,
            ),
          );
          if (workspace === undefined) {
            return yield* new WorkspaceNotFound();
          }
          return workspace;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const listMembers = Effect.fn("WorkspaceService.listMembers")(
        function* (input: { slug: string; actorId: string }) {
          const workspace = yield* requireWorkspace(input.slug, input.actorId);
          return yield* database.use((db) =>
            workspaceData.listWorkspaceUsers({ workspaceId: workspace.id }, db),
          );
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const getMember = Effect.fn("WorkspaceService.getMember")(
        function* (input: { slug: string; actorId: string; userId: string }) {
          const workspace = yield* requireWorkspace(input.slug, input.actorId);
          const member = yield* database.use((db) =>
            workspaceData.getWorkspaceMember(
              { workspaceId: workspace.id, userId: input.userId },
              db,
            ),
          );
          if (member === undefined) {
            return yield* new MemberNotFound();
          }
          return member;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const getPreferredWorkspaceForUser = Effect.fn(
        "WorkspaceService.getPreferredWorkspaceForUser",
      )(function* (input: { user: Pick<User, "lastWorkspaceId" | "id"> }) {
        const { lastWorkspaceId } = input.user;
        if (lastWorkspaceId) {
          const workspace = yield* database.use((db) =>
            workspaceData.getWorkspaceById(lastWorkspaceId, db),
          );
          if (workspace !== undefined) {
            return workspace;
          }
        }
        const workspace = yield* database.use((db) =>
          workspaceData.getFirstWorkspaceForUser({ userId: input.user.id }, db),
        );
        return workspace ?? null;
      }, Effect.orDie);

      const saveLastWorkspaceForUser = Effect.fn("WorkspaceService.saveLastWorkspaceForUser")(
        function* (input: { userId: string; workspaceId: string }) {
          yield* database.use((db) => workspaceData.saveLastWorkspaceForUser(input, db));
        },
        Effect.orDie,
      );

      return WorkspaceService.of({
        createWorkspace,
        requireWorkspace,
        isWorkspaceMember,
        listUserWorkspaces,
        updateWorkspace,
        listMembers,
        getMember,
        getPreferredWorkspaceForUser,
        saveLastWorkspaceForUser,
      });
    }),
  );
}

export type WorkspaceServiceShape = WorkspaceService["Service"];
