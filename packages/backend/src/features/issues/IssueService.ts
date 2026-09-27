import { Database } from "@blackwall/database/effect";
import { IssueNotFound, TeamNotFoundOrAccessDenied } from "@blackwall/shared";
import { Context, Effect, Layer } from "effect";
import { TeamService } from "../teams/TeamService";
import { issueData } from "./issue.data";

type IssueWithDetails = NonNullable<Awaited<ReturnType<typeof issueData.getIssueByKey>>>;
type IssuePage = Awaited<ReturnType<typeof issueData.listIssuesInSprint>>;

export class IssueService extends Context.Service<
  IssueService,
  {
    /**
     * The issue with this key in the workspace. Also resolves keys a team used
     * before a rename. Doesn't check team membership.
     */
    readonly requireIssue: (input: {
      workspaceId: string;
      issueKey: string;
    }) => Effect.Effect<IssueWithDetails, IssueNotFound>;
    /** Like `requireIssue`, and the user must belong to the issue's team. */
    readonly requireIssueForUser: (input: {
      workspaceId: string;
      issueKey: string;
      userId: string;
    }) => Effect.Effect<IssueWithDetails, IssueNotFound | TeamNotFoundOrAccessDenied>;
    /** A page of the sprint's issues, ordered by id. Doesn't check team membership. */
    readonly listIssuesInSprint: (input: {
      workspaceId: string;
      teamId: string;
      sprintId: string;
      cursor?: string | undefined;
      limit?: number | undefined;
    }) => Effect.Effect<IssuePage>;
  }
>()("blackwall/IssueService") {
  static readonly layer = Layer.effect(
    IssueService,
    Effect.gen(function* () {
      const database = yield* Database;
      const teams = yield* TeamService;

      const requireIssue = Effect.fn("IssueService.requireIssue")(
        function* (input: { workspaceId: string; issueKey: string }) {
          const issue = yield* database.use((db) => issueData.getIssueByKey(input, db));
          if (issue === undefined) {
            return yield* new IssueNotFound();
          }
          return issue;
        },
        Effect.catchTag("DatabaseError", Effect.die),
      );

      const requireIssueForUser = Effect.fn("IssueService.requireIssueForUser")(function* (input: {
        workspaceId: string;
        issueKey: string;
        userId: string;
      }) {
        const issue = yield* requireIssue(input);
        if (issue.team === null) {
          return yield* new IssueNotFound();
        }
        yield* teams.requireTeamForUser({
          workspaceId: input.workspaceId,
          teamKey: issue.team.key,
          userId: input.userId,
        });
        return issue;
      });

      const listIssuesInSprint = Effect.fn("IssueService.listIssuesInSprint")(function* (input: {
        workspaceId: string;
        teamId: string;
        sprintId: string;
        cursor?: string | undefined;
        limit?: number | undefined;
      }) {
        return yield* database.use((db) => issueData.listIssuesInSprint(input, db));
      }, Effect.orDie);

      return IssueService.of({ requireIssue, requireIssueForUser, listIssuesInSprint });
    }),
  );
}
