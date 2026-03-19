import { dbSchema } from "@blackwall/database";
import type { TestDb } from "./setup";

type WorkspaceInsert = typeof dbSchema.workspace.$inferInsert;
type UserInsert = typeof dbSchema.user.$inferInsert;
type TeamInsert = typeof dbSchema.team.$inferInsert;
type IssueSprintInsert = typeof dbSchema.issueSprint.$inferInsert;
type IssueInsert = typeof dbSchema.issue.$inferInsert;
type WorkspaceUserInsert = typeof dbSchema.workspaceUser.$inferInsert;
type UserTeamInsert = typeof dbSchema.userTeam.$inferInsert;

let issueSequence = 1;

export function buildWorkspace(overrides: Partial<WorkspaceInsert> = {}): WorkspaceInsert {
  return {
    slug: "test-workspace",
    displayName: "Test Workspace",
    logoUrl: null,
    ...overrides,
  };
}

export function buildUser(overrides: Partial<UserInsert> = {}): UserInsert {
  return {
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildTeam(overrides: Partial<TeamInsert> = {}): TeamInsert {
  return {
    name: "Test Team",
    key: "TST",
    workspaceId: overrides.workspaceId ?? "",
    avatar: null,
    activeSprintId: null,
    ...overrides,
  };
}

export function buildIssueSprint(overrides: Partial<IssueSprintInsert> = {}): IssueSprintInsert {
  return {
    name: "Test Sprint",
    goal: "Test goal",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-12-31"),
    teamId: overrides.teamId ?? "",
    createdById: overrides.createdById ?? "",
    ...overrides,
  };
}

export function buildIssue(overrides: Partial<IssueInsert> = {}): IssueInsert {
  return {
    key: "TST-1",
    keyNumber: 1,
    summary: "Test Issue",
    description: {},
    status: "to_do",
    priority: "medium",
    sortOrder: 0,
    workspaceId: overrides.workspaceId ?? "",
    teamId: overrides.teamId ?? "",
    createdById: overrides.createdById ?? "",
    assignedToId: null,
    sprintId: null,
    ...overrides,
  };
}

export async function createWorkspace(testDb: TestDb, overrides: Partial<WorkspaceInsert> = {}) {
  const [workspace] = await testDb.db
    .insert(dbSchema.workspace)
    .values(buildWorkspace(overrides))
    .returning();

  return workspace;
}

export async function createUser(testDb: TestDb, overrides: Partial<UserInsert> = {}) {
  const [user] = await testDb.db.insert(dbSchema.user).values(buildUser(overrides)).returning();

  return user;
}

export async function createTeam(testDb: TestDb, overrides: Partial<TeamInsert> = {}) {
  const [team] = await testDb.db.insert(dbSchema.team).values(buildTeam(overrides)).returning();

  return team;
}

export async function createIssueSprint(
  testDb: TestDb,
  overrides: Partial<IssueSprintInsert> = {},
) {
  const [sprint] = await testDb.db
    .insert(dbSchema.issueSprint)
    .values(buildIssueSprint(overrides))
    .returning();

  return sprint;
}

export async function createIssue(testDb: TestDb, overrides: Partial<IssueInsert> = {}) {
  const nextIssueNumber = issueSequence++;
  const keyNumber = overrides.keyNumber ?? nextIssueNumber;
  const key = overrides.key ?? `TST-${keyNumber}`;

  const [issue] = await testDb.db
    .insert(dbSchema.issue)
    .values(buildIssue({ ...overrides, keyNumber, key }))
    .returning();

  return issue;
}

export async function addUserToWorkspace(testDb: TestDb, overrides: WorkspaceUserInsert) {
  await testDb.db.insert(dbSchema.workspaceUser).values(overrides);
}

export async function addUserToTeam(testDb: TestDb, overrides: UserTeamInsert) {
  await testDb.db.insert(dbSchema.userTeam).values(overrides);
}

/**
 * Creates a complete test setup with user, workspace, team, and relationships.
 * Returns the seeded data that can be used to log in via the auth API.
 */
export async function seedTestSetup(testDb: TestDb) {
  const password = "password123";
  const hashedPassword =
    "$argon2id$v=19$m=4,t=2,p=1$s/neahDY1EbGesKHBNQkXUdvjqb4tQD2xZe57GgqdBI$rISXzz9lbfw7xilkZPBJcdaRsTS97TcK4j/ZB2MfexE";

  const user = await createUser(testDb, {
    id: "019c01e2-cc15-7000-af2d-eaad0c34947d",
    email: "test@example.com",
    name: "Test User",
  });

  const workspace = await createWorkspace(testDb, {
    slug: "test-workspace",
    displayName: "Test Workspace",
  });

  const team = await createTeam(testDb, {
    key: "TES",
    name: "Test Team",
    workspaceId: workspace.id,
  });

  await testDb.db.insert(dbSchema.account).values({
    id: "019c01e2-cc15-7000-af2d-eaad0c34947d",
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: hashedPassword,
  });

  await addUserToWorkspace(testDb, {
    userId: user.id,
    workspaceId: workspace.id,
  });

  await addUserToTeam(testDb, {
    userId: user.id,
    teamId: team.id,
  });

  const [session] = await testDb.db
    .insert(dbSchema.session)
    .values({
      id: "019c0218-d86c-7000-8c81-1f809d9aa662",
      userId: "019c01e2-cc15-7000-af2d-eaad0c34947d",
      token: "tjdw3LQ7r9EmkM15koef0oS4TKqi7RNd",
      expiresAt: new Date(Date.now() + 604800000),
      ipAddress: "",
      userAgent: "",
    })
    .returning();

  const cookie =
    "better-auth.session_token=tjdw3LQ7r9EmkM15koef0oS4TKqi7RNd.Fk136moeGsB9db9B2kDmT2cNHbO8FivNmZbMIICuQMc%3D; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax";

  return {
    user,
    workspace,
    team,
    password,
    session,
    cookie,
  };
}
