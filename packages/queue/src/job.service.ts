import type { Job, JobStatus } from "@blackwall/database";
import { jobData } from "./job.data";

type JobHandler<T = unknown> = (payload: T) => Promise<void>;

type ProcessResult = {
  job: Job;
  success: boolean;
  error?: string;
  handlerFound: boolean;
};

type WorkerLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
};

type WorkerOptions = {
  queue: string;
  pollIntervalMs?: number;
  staleCheckIntervalMs?: number;
  cleanupIntervalMs?: number;
  lockDurationMs?: number;
  signal?: AbortSignal;
  logger?: Partial<WorkerLogger>;
};

type ProcessOptions = {
  queue: string;
  lockDurationMs?: number;
  onStart?: (job: Job) => void;
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

function resolveLogger(logger?: Partial<WorkerLogger>): WorkerLogger {
  return {
    info: logger?.info ?? ((message) => console.log(message)),
    error: logger?.error ?? ((message) => console.error(message)),
  };
}

async function processNextJob(options: ProcessOptions): Promise<ProcessResult | null> {
  const job = await claimJob(options.queue, options.lockDurationMs);
  if (!job) return null;

  options.onStart?.(job);

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

async function runWorker(options: WorkerOptions) {
  const {
    queue,
    pollIntervalMs = 1000,
    staleCheckIntervalMs = 30_000,
    cleanupIntervalMs = 60 * 60 * 1000,
    lockDurationMs = 30_000,
    signal,
    logger,
  } = options;

  const log = resolveLogger(logger);

  log.info(`[worker] Starting worker for queue: ${queue}`);

  let lastStaleCheck = 0;
  let lastCleanup = 0;

  while (!signal?.aborted) {
    const now = Date.now();

    if (now - lastStaleCheck > staleCheckIntervalMs) {
      const recovered = await recoverStaleJobs();
      if (recovered > 0) {
        log.info(`[worker] Recovered ${recovered} stale job(s)`);
      }
      lastStaleCheck = now;
    }

    if (now - lastCleanup > cleanupIntervalMs) {
      await cleanupJobs();
      lastCleanup = now;
    }

    const result = await processNextJob({
      queue,
      lockDurationMs,
      onStart: (job) => {
        log.info(`[worker] Processing ${job.type} (${job.id}), attempt ${job.attempts}`);
      },
    });

    if (!result) {
      await Bun.sleep(pollIntervalMs);
      continue;
    }

    if (result.success) {
      log.info(`[worker] Completed ${result.job.id}`);
      continue;
    }

    if (!result.handlerFound) {
      log.error(`[worker] No handler for job type: ${result.job.type}`);
    }

    if (result.error) {
      log.error(`[worker] Failed ${result.job.id}: ${result.error}`);
    }
  }

  log.info("[worker] Stopped");
}

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
