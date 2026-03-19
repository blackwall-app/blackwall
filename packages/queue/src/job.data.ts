import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db, dbSchema, type Job, type JobStatus } from "@blackwall/database";

async function addJob<T>(input: {
  type: string;
  payload: T;
  queue?: string;
  delay?: number;
  maxAttempts?: number;
}) {
  const now = new Date();
  const runAt = input.delay ? new Date(now.getTime() + input.delay) : null;

  const [job] = await db
    .insert(dbSchema.job)
    .values({
      queue: input.queue ?? "default",
      type: input.type,
      payload: JSON.stringify(input.payload),
      maxAttempts: input.maxAttempts ?? 3,
      runAt,
      createdAt: now,
    })
    .returning();

  return job;
}

async function claimJob(queue: string, lockDurationMs = 30_000): Promise<Job | null> {
  const now = Date.now();
  const lockUntil = new Date(now + lockDurationMs);

  const result = db.all<Job>(sql`
    UPDATE ${dbSchema.job}
    SET
      status = 'processing',
      locked_until = ${lockUntil.getTime()},
      attempts = attempts + 1
    WHERE id = (
      SELECT id FROM ${dbSchema.job}
      WHERE queue = ${queue}
        AND status = 'pending'
        AND (run_at IS NULL OR run_at <= ${now})
      ORDER BY created_at
      LIMIT 1
    )
    RETURNING *
  `);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    ...row,
    runAt: row.runAt ? new Date(row.runAt as unknown as number) : null,
    lockedUntil: row.lockedUntil ? new Date(row.lockedUntil as unknown as number) : null,
    createdAt: new Date(row.createdAt as unknown as number),
    completedAt: row.completedAt ? new Date(row.completedAt as unknown as number) : null,
  };
}

async function completeJob(id: string) {
  await db
    .update(dbSchema.job)
    .set({
      status: "completed",
      completedAt: new Date(),
      lockedUntil: null,
    })
    .where(eq(dbSchema.job.id, id));
}

async function getJobById(id: string) {
  const [job] = await db.select().from(dbSchema.job).where(eq(dbSchema.job.id, id));
  return job;
}

async function failJob(id: string, error: string) {
  const job = await getJobById(id);
  if (!job) return;

  const shouldRetry = job.attempts < job.maxAttempts;
  const backoffMs = Math.min(1000 * Math.pow(2, job.attempts), 300_000);

  await db
    .update(dbSchema.job)
    .set({
      status: shouldRetry ? "pending" : "failed",
      lastError: error,
      lockedUntil: null,
      runAt: shouldRetry ? new Date(Date.now() + backoffMs) : job.runAt,
    })
    .where(eq(dbSchema.job.id, id));
}

async function retryFailedJob(id: string) {
  const job = await getJobById(id);
  if (!job) {
    throw new Error(`Job not found: ${id}`);
  }

  if (job.status !== "failed") {
    throw new Error(`Only failed jobs can be retried: ${id}`);
  }

  const [retriedJob] = await db
    .insert(dbSchema.job)
    .values({
      queue: "default",
      type: job.type,
      payload: job.payload,
      maxAttempts: job.maxAttempts,
      createdAt: new Date(),
    })
    .returning();

  return retriedJob;
}

async function recoverStaleJobs() {
  const now = new Date();

  const result = await db
    .update(dbSchema.job)
    .set({
      status: "pending",
      lockedUntil: null,
    })
    .where(and(eq(dbSchema.job.status, "processing"), lte(dbSchema.job.lockedUntil, now)))
    .returning({ id: dbSchema.job.id });

  return result.length;
}

async function cleanupJobs(opts?: { completedOlderThanMs?: number; failedOlderThanMs?: number }) {
  const completedCutoff = new Date(
    Date.now() - (opts?.completedOlderThanMs ?? 7 * 24 * 60 * 60 * 1000),
  );
  const failedCutoff = new Date(Date.now() - (opts?.failedOlderThanMs ?? 30 * 24 * 60 * 60 * 1000));

  await db
    .delete(dbSchema.job)
    .where(
      and(eq(dbSchema.job.status, "completed"), lte(dbSchema.job.completedAt, completedCutoff)),
    );

  await db
    .delete(dbSchema.job)
    .where(and(eq(dbSchema.job.status, "failed"), lte(dbSchema.job.createdAt, failedCutoff)));
}

async function clearJobs(opts?: { queue?: string; statuses?: JobStatus[] }) {
  const conditions = [];
  if (opts?.queue) {
    conditions.push(eq(dbSchema.job.queue, opts.queue));
  }
  if (opts?.statuses && opts.statuses.length > 0) {
    conditions.push(inArray(dbSchema.job.status, opts.statuses));
  }

  const deleted = await db
    .delete(dbSchema.job)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .returning({ id: dbSchema.job.id });

  return deleted.length;
}

async function getJobStats(queue?: string) {
  const rows = db.all<{ status: JobStatus; count: number }>(sql`
    SELECT status, COUNT(*) as count
    FROM ${dbSchema.job}
    ${queue ? sql`WHERE queue = ${queue}` : sql``}
    GROUP BY status
  `);

  return Object.fromEntries(rows.map((r) => [r.status, r.count]));
}

async function listJobs(input: { queue?: string; status?: JobStatus; limit?: number }) {
  const conditions = [];
  if (input.queue) {
    conditions.push(eq(dbSchema.job.queue, input.queue));
  }
  if (input.status) {
    conditions.push(eq(dbSchema.job.status, input.status));
  }

  const jobs = await db
    .select()
    .from(dbSchema.job)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .limit(input.limit ?? 100)
    .orderBy(dbSchema.job.createdAt);

  return jobs;
}

export const jobData = {
  addJob,
  claimJob,
  completeJob,
  failJob,
  retryFailedJob,
  getJobById,
  recoverStaleJobs,
  cleanupJobs,
  clearJobs,
  getJobStats,
  listJobs,
};
