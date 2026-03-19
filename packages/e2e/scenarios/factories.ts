import { db, dbSchema } from "@blackwall/database";
import { and, eq, sql } from "drizzle-orm";
import { E2E_DEFAULTS } from "./constants.ts";

type JSONContent = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JSONContent[];
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
};

const PASSWORD_HASH_OPTIONS = {
  algorithm: "argon2id" as const,
  memoryCost: 8192,
  timeCost: 1,
};

export type SeededBaseFixtures = {
  workspace: typeof dbSchema.workspace.$inferSelect;
  team: typeof dbSchema.team.$inferSelect;
  user: typeof dbSchema.user.$inferSelect;
};

export type CreateIssueOptions = {
  workspaceId: string;
  teamId: string;
  createdById: string;
  summary: string;
  status?: "to_do" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  sprintId?: string | null;
  assignedToId?: string | null;
  estimationPoints?: number | null;
  description?: JSONContent;
};

export type CreateSprintOptions = {
  teamId: string;
  createdById: string;
  name: string;
  goal?: string | null;
  status?: "planned" | "active" | "completed";
  startDate?: Date;
  endDate?: Date;
  archivedAt?: Date | null;
};

export type CreateUserOptions = {
  email: string;
  password: string;
  name: string;
  workspaceId?: string;
  teamId?: string;
};

export type CreateLabelOptions = {
  workspaceId: string;
  name: string;
  colorKey?: (typeof dbSchema.label.$inferInsert)["colorKey"];
};

export type CreateInvitationOptions = {
  workspaceId: string;
  createdById: string;
  email: string;
  token: string;
  expiresAt?: Date | null;
};

export function emptyDoc(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function textDoc(text: string): JSONContent {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export async function insertBaseFixtures(): Promise<SeededBaseFixtures> {
  const [workspace] = await db
    .insert(dbSchema.workspace)
    .values({
      slug: E2E_DEFAULTS.workspace.slug,
      displayName: E2E_DEFAULTS.workspace.displayName,
    })
    .returning();

  if (!workspace) {
    throw new Error("Failed to create workspace");
  }

  const passwordHash = await Bun.password.hash(
    E2E_DEFAULTS.users.primary.password,
    PASSWORD_HASH_OPTIONS,
  );
  const now = new Date();

  const [user] = await db
    .insert(dbSchema.user)
    .values({
      name: E2E_DEFAULTS.users.primary.name,
      email: E2E_DEFAULTS.users.primary.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!user) {
    throw new Error("Failed to create user");
  }

  await db.insert(dbSchema.account).values({
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: passwordHash,
  });

  await db.insert(dbSchema.workspaceUser).values({
    workspaceId: workspace.id,
    userId: user.id,
  });

  const [team] = await db
    .insert(dbSchema.team)
    .values({
      key: E2E_DEFAULTS.team.key,
      name: E2E_DEFAULTS.team.name,
      workspaceId: workspace.id,
    })
    .returning();

  if (!team) {
    throw new Error("Failed to create team");
  }

  await db.insert(dbSchema.issueSequence).values({
    workspaceId: workspace.id,
    teamId: team.id,
    currentSequence: 0,
  });

  await db.insert(dbSchema.userTeam).values({
    userId: user.id,
    teamId: team.id,
  });

  await db
    .update(dbSchema.user)
    .set({ lastWorkspaceId: workspace.id, lastTeamId: team.id })
    .where(eq(dbSchema.user.id, user.id));

  return { workspace, team, user };
}

export async function createIssue(
  options: CreateIssueOptions,
): Promise<typeof dbSchema.issue.$inferSelect> {
  const [sequence] = await db
    .update(dbSchema.issueSequence)
    .set({ currentSequence: sql`${dbSchema.issueSequence.currentSequence} + 1` })
    .where(
      and(
        eq(dbSchema.issueSequence.workspaceId, options.workspaceId),
        eq(dbSchema.issueSequence.teamId, options.teamId),
      ),
    )
    .returning();

  if (!sequence) {
    throw new Error("Failed to increment issue sequence");
  }

  const keyNumber = sequence.currentSequence;
  const [team] = await db
    .select({ key: dbSchema.team.key })
    .from(dbSchema.team)
    .where(eq(dbSchema.team.id, options.teamId))
    .limit(1);

  if (!team) {
    throw new Error(`Team not found: ${options.teamId}`);
  }

  const [issue] = await db
    .insert(dbSchema.issue)
    .values({
      key: `${team.key}-${keyNumber}`,
      keyNumber,
      workspaceId: options.workspaceId,
      teamId: options.teamId,
      createdById: options.createdById,
      summary: options.summary,
      status: options.status ?? "to_do",
      priority: options.priority ?? "medium",
      description: options.description ?? emptyDoc(),
      sortOrder: keyNumber,
      sprintId: options.sprintId ?? null,
      assignedToId: options.assignedToId ?? null,
      estimationPoints: options.estimationPoints ?? null,
    })
    .returning();

  if (!issue) {
    throw new Error("Failed to create issue");
  }

  return issue;
}

export async function createSprint(
  options: CreateSprintOptions,
): Promise<typeof dbSchema.issueSprint.$inferSelect> {
  const now = new Date();
  const [sprint] = await db
    .insert(dbSchema.issueSprint)
    .values({
      teamId: options.teamId,
      createdById: options.createdById,
      name: options.name,
      goal: options.goal ?? null,
      status: options.status ?? "planned",
      startDate: options.startDate ?? now,
      endDate: options.endDate ?? new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      archivedAt: options.archivedAt ?? null,
    })
    .returning();

  if (!sprint) {
    throw new Error("Failed to create sprint");
  }

  if (sprint.status === "active") {
    await db
      .update(dbSchema.team)
      .set({ activeSprintId: sprint.id })
      .where(eq(dbSchema.team.id, options.teamId));
  }

  return sprint;
}

export async function createUser(
  options: CreateUserOptions,
): Promise<typeof dbSchema.user.$inferSelect> {
  const passwordHash = await Bun.password.hash(options.password, PASSWORD_HASH_OPTIONS);
  const now = new Date();

  const [user] = await db
    .insert(dbSchema.user)
    .values({
      name: options.name,
      email: options.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!user) {
    throw new Error("Failed to create user");
  }

  await db.insert(dbSchema.account).values({
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: passwordHash,
  });

  if (options.workspaceId) {
    await db.insert(dbSchema.workspaceUser).values({
      workspaceId: options.workspaceId,
      userId: user.id,
    });
  }

  if (options.teamId) {
    await db.insert(dbSchema.userTeam).values({
      userId: user.id,
      teamId: options.teamId,
    });
  }

  return user;
}

export async function createLabel(
  options: CreateLabelOptions,
): Promise<typeof dbSchema.label.$inferSelect> {
  const [label] = await db
    .insert(dbSchema.label)
    .values({
      workspaceId: options.workspaceId,
      name: options.name,
      colorKey: options.colorKey ?? "blue",
    })
    .returning();

  if (!label) {
    throw new Error("Failed to create label");
  }

  return label;
}

export async function createInvitation(
  options: CreateInvitationOptions,
): Promise<typeof dbSchema.workspaceInvitation.$inferSelect> {
  const [invitation] = await db
    .insert(dbSchema.workspaceInvitation)
    .values({
      workspaceId: options.workspaceId,
      createdById: options.createdById,
      email: options.email,
      token: options.token,
      expiresAt: options.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();

  if (!invitation) {
    throw new Error("Failed to create invitation");
  }

  return invitation;
}
