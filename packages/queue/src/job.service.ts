import { Effect, Schedule } from "effect";
import type { Job, JobStatus } from "@blackwall/database";
import { jobData } from "./job.data";

type JobHandler<T = unknown> = (payload: T) => Promise<void>;

type ProcessResult = {
  job: Job;
  success: boolean;
  error?: string;
  handlerFound: boolean;
};

type WorkerOptions = {
  queue: string;
  pollIntervalMs?: number;
  staleCheckIntervalMs?: number;
  cleanupIntervalMs?: number;
  lockDurationMs?: number;
};

type ProcessOptions = {
  queue: string;
  lockDurationMs?: number;
};

const handlers = new Map<string, JobHandler>();

/**
 * Register a handler for a specific job type.
 * @param type job type identifier
 * @param handler async function to process the job payload
 */
function registerHandler<T>(type: string, handler: JobHandler<T>) {
  handlers.set(type, handler as JobHandler);
}

/**
 * Get the registered handler for a job type.
 * @param type job type identifier
 * @returns handler function or undefined
 */
function getHandler(type: string): JobHandler | undefined {
  return handlers.get(type);
}

/**
 * Add a new job to the queue.
 * @param input job type, payload, and optional queue/delay/maxAttempts
 * @returns created job
 */
async function addJob<T>(input: {
  type: string;
  payload: T;
  queue?: string;
  delay?: number;
  maxAttempts?: number;
}) {
  return jobData.addJob(input);
}

/**
 * Claim the next available job from a queue for processing.
 * @param queue queue name
 * @param lockDurationMs duration to lock the job (default 30s)
 * @returns claimed job or null
 */
async function claimJob(queue: string, lockDurationMs = 30_000) {
  return jobData.claimJob(queue, lockDurationMs);
}

/**
 * Mark a job as successfully completed.
 * @param id job id
 */
async function completeJob(id: string) {
  return jobData.completeJob(id);
}

/**
 * Mark a job as failed with an error message.
 * @param id job id
 * @param error error message
 */
async function failJob(id: string, error: string) {
  return jobData.failJob(id, error);
}

/**
 * Create a new pending job from a failed job, preserving its type and payload.
 * @param id failed job id
 * @returns newly created job
 */
async function retryFailedJob(id: string) {
  return jobData.retryFailedJob(id);
}

/**
 * Recover jobs that were locked but never completed (stale).
 * @returns number of recovered jobs
 */
async function recoverStaleJobs() {
  return jobData.recoverStaleJobs();
}

/**
 * Clean up old completed and failed jobs.
 * @param opts optional age thresholds for cleanup
 */
async function cleanupJobs(opts?: { completedOlderThanMs?: number; failedOlderThanMs?: number }) {
  return jobData.cleanupJobs(opts);
}

/**
 * Clear jobs from the queue.
 * @param opts optional queue and status filters
 * @returns number of deleted jobs
 */
async function clearJobs(opts?: { queue?: string; statuses?: JobStatus[] }) {
  return jobData.clearJobs(opts);
}

/**
 * Get statistics about jobs in a queue.
 * @param queue optional queue name filter
 * @returns job statistics
 */
async function getJobStats(queue?: string) {
  return jobData.getJobStats(queue);
}

/**
 * List jobs with optional filters.
 * @param input optional queue, status, and limit filters
 * @returns list of jobs
 */
async function listJobs(input: { queue?: string; status?: JobStatus; limit?: number }) {
  return jobData.listJobs(input);
}

/**
 * Get a job by its id.
 * @param id job id
 * @returns job data or null
 */
async function getJobById(id: string) {
  return jobData.getJobById(id);
}

async function runClaimedJob(job: Job): Promise<ProcessResult> {
  const handler = getHandler(job.type);
  if (!handler) {
    await failJob(job.id, `No handler registered for job type: ${job.type}`);
    return {
      job,
      success: false,
      error: `No handler registered for job type: ${job.type}`,
      handlerFound: false,
    };
  }

  try {
    const payload = JSON.parse(job.payload);
    await handler(payload);
    await completeJob(job.id);
    return { job, success: true, handlerFound: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await failJob(job.id, errorMessage);
    return { job, success: false, error: errorMessage, handlerFound: true };
  }
}

async function processNextJob(options: ProcessOptions): Promise<ProcessResult | null> {
  const job = await claimJob(options.queue, options.lockDurationMs);
  if (!job) return null;
  return runClaimedJob(job);
}

/**
 * Claim and process a job from a queue using its registered handler.
 * @param queue queue name
 * @param lockDurationMs duration to lock the job (default 30s)
 * @returns processing result with job and success status, or null if no job
 */
async function processJob(queue: string, lockDurationMs = 30_000) {
  const result = await processNextJob({ queue, lockDurationMs });
  if (!result) return null;
  return { job: result.job, success: result.success, error: result.error };
}

const runNextJob = Effect.fnUntraced(
  function* (queue: string, lockDurationMs: number) {
    const job = yield* Effect.tryPromise(() => claimJob(queue, lockDurationMs));
    if (!job) return false;

    yield* Effect.logInfo(`Processing ${job.type} (${job.id}), attempt ${job.attempts}`);
    const result = yield* Effect.tryPromise(() => runClaimedJob(job));

    if (result.success) {
      yield* Effect.logInfo(`Completed ${job.id}`);
    } else if (!result.handlerFound) {
      yield* Effect.logError(`No handler for job type: ${job.type}`);
    } else {
      yield* Effect.logError(`Failed ${job.id}: ${result.error}`);
    }
    return true;
  },
  Effect.uninterruptible,
  Effect.catch((error) => Effect.as(Effect.logError("Job processing failed", error), false)),
);

const recoverStaleJobsInWorker = Effect.tryPromise(() => recoverStaleJobs()).pipe(
  Effect.tap((recovered) =>
    recovered > 0 ? Effect.logInfo(`Recovered ${recovered} stale job(s)`) : Effect.void,
  ),
  Effect.uninterruptible,
  Effect.catch((error) => Effect.logError("Stale job recovery failed", error)),
);

const cleanupJobsInWorker = Effect.tryPromise(() => cleanupJobs()).pipe(
  Effect.uninterruptible,
  Effect.catch((error) => Effect.logError("Job cleanup failed", error)),
);

/**
 * Process jobs from a queue until interrupted. Polling, stale-job recovery, and
 * cleanup run as concurrent fibers. Interrupting waits for the in-flight job.
 * @param options queue name and interval overrides
 */
const runWorker = Effect.fn("jobService.runWorker")(
  function* (options: WorkerOptions) {
    const {
      queue,
      pollIntervalMs = 1000,
      staleCheckIntervalMs = 30_000,
      cleanupIntervalMs = 60 * 60 * 1000,
      lockDurationMs = 30_000,
    } = options;

    yield* Effect.logInfo(`Starting worker for queue: ${queue}`);

    const drainQueue = runNextJob(queue, lockDurationMs).pipe(Effect.repeat({ while: Boolean }));

    yield* Effect.all(
      [
        Effect.repeat(drainQueue, Schedule.spaced(pollIntervalMs)),
        Effect.repeat(recoverStaleJobsInWorker, Schedule.spaced(staleCheckIntervalMs)),
        Effect.repeat(cleanupJobsInWorker, Schedule.spaced(cleanupIntervalMs)),
      ],
      { concurrency: "unbounded", discard: true },
    );
  },
  (effect, options) =>
    effect.pipe(
      Effect.onInterrupt(() => Effect.logInfo("Worker stopped")),
      Effect.annotateLogs({ worker: options.queue }),
    ),
);

/**
 * Clear all registered job handlers. Useful for testing.
 */
function clearHandlers() {
  handlers.clear();
}

export const jobService = {
  registerHandler,
  getHandler,
  addJob,
  claimJob,
  completeJob,
  failJob,
  retryFailedJob,
  recoverStaleJobs,
  cleanupJobs,
  clearJobs,
  getJobStats,
  listJobs,
  getJobById,
  processJob,
  processNextJob,
  runWorker,
  clearHandlers,
};

export type { JobHandler, ProcessResult, WorkerOptions };
