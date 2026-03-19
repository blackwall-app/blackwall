import { jobService, type JobStatus, jobStatusValues } from "@blackwall/queue";
import { formatJob, parseJsonArg, parseNumber, printJson } from "./utils";

interface AddOptions {
  type: string;
  payload: string;
  delayMs?: string;
  maxAttempts?: string;
}

export async function add(options: AddOptions) {
  const payload = parseJsonArg(options.payload, "--payload");

  const job = await jobService.addJob({
    type: options.type,
    payload,
    delay: options.delayMs ? parseNumber(options.delayMs, "--delay-ms") : undefined,
    maxAttempts: options.maxAttempts
      ? parseNumber(options.maxAttempts, "--max-attempts")
      : undefined,
  });

  printJson({ job: formatJob(job) });
}

interface StatsOptions {}

export async function stats(_options: StatsOptions) {
  const result = await jobService.getJobStats("default");
  printJson({ stats: result });
}

interface ListOptions {
  status?: string;
  limit?: string;
}

export async function list(options: ListOptions) {
  const statusRaw = options.status as string | undefined;
  if (statusRaw && !jobStatusValues.includes(statusRaw as JobStatus)) {
    throw new Error(`Invalid --status. Expected one of: ${jobStatusValues.join(", ")}`);
  }

  const jobs = await jobService.listJobs({
    queue: "default",
    status: statusRaw as JobStatus | undefined,
    limit: options.limit ? parseNumber(options.limit, "--limit") : undefined,
  });

  printJson({ jobs: jobs.map(formatJob) });
}

interface GetOptions {
  id: string;
}

export async function get(options: GetOptions) {
  const job = await jobService.getJobById(options.id);
  if (!job) {
    throw new Error(`Job not found: ${options.id}`);
  }
  printJson({ job: formatJob(job) });
}

interface ProcessOptions {
  lockDurationMs?: string;
}

export async function processJob(options: ProcessOptions) {
  const result = await jobService.processNextJob({
    queue: "default",
    lockDurationMs: options.lockDurationMs
      ? parseNumber(options.lockDurationMs, "--lock-duration-ms")
      : undefined,
  });

  if (!result) {
    printJson({ processed: false });
    return;
  }

  const payload = {
    processed: true,
    success: result.success,
    job: formatJob(result.job),
    error: result.error,
  };

  printJson(payload);
  if (!result.success) {
    globalThis.process.exitCode = 1;
  }
}

export async function recoverStale() {
  const recovered = await jobService.recoverStaleJobs();
  printJson({ recovered });
}

interface RetryOptions {
  id: string;
}

export async function retry(options: RetryOptions) {
  const job = await jobService.retryFailedJob(options.id);
  printJson({
    retried: true,
    sourceJobId: options.id,
    job: formatJob(job),
  });
}

interface CleanupOptions {
  completedOlderThanMs?: string;
  failedOlderThanMs?: string;
}

export async function cleanup(options: CleanupOptions) {
  await jobService.cleanupJobs({
    completedOlderThanMs: options.completedOlderThanMs
      ? parseNumber(options.completedOlderThanMs, "--completed-older-than-ms")
      : undefined,
    failedOlderThanMs: options.failedOlderThanMs
      ? parseNumber(options.failedOlderThanMs, "--failed-older-than-ms")
      : undefined,
  });

  printJson({ success: true });
}

interface ClearOptions {
  all?: boolean;
}

export async function clear(options: ClearOptions) {
  const deleted = await jobService.clearJobs({
    queue: "default",
    statuses: options.all ? undefined : ["pending"],
  });

  printJson({
    success: true,
    deleted,
    scope: options.all ? "all" : "pending",
  });
}
