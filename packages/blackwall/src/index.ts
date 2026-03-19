import { Command } from "commander";
import { serve } from "./commands/serve";
import { migrate } from "./commands/migrate";
import { worker } from "./commands/worker";
import {
  add,
  stats,
  list,
  get,
  processJob,
  recoverStale,
  cleanup,
  clear,
  retry,
} from "./commands/jobs";
import { jobStatusValues } from "@blackwall/queue";

const program = new Command();

program
  .name("blackwall")
  .description("Blackwall - Project management for software teams")
  .version("0.1.0");

program
  .command("serve", { isDefault: true })
  .description("Start the HTTP server")
  .option("-p, --port <port>", "Port to listen on", "8000")
  .option("--public-dir <path>", "Directory containing static files", "./public")
  .action(serve);

program
  .command("migrate")
  .description("Run database migrations")
  .option("--migrations-dir <path>", "Directory containing migration files", "./migrations")
  .action(migrate);

program
  .command("worker")
  .description("Run the job queue worker")
  .option("--poll-interval-ms <ms>", "How often to poll for new jobs")
  .option("--stale-check-interval-ms <ms>", "How often to recover stale jobs")
  .option("--cleanup-interval-ms <ms>", "How often to cleanup completed/failed jobs")
  .option("--lock-duration-ms <ms>", "How long to lock a claimed job")
  .action(worker);

// Jobs subcommands
const jobs = program.command("jobs").description("Manage job queue");

jobs
  .command("add")
  .description("Add a job to the queue")
  .requiredOption("--type <type>", "Job type")
  .requiredOption("--payload <json>", "Job payload as JSON")
  .option("--delay-ms <ms>", "Delay in milliseconds")
  .option("--max-attempts <n>", "Max retry attempts")
  .action(add);

jobs.command("stats").description("Get job queue statistics").action(stats);

jobs
  .command("list")
  .description("List jobs in the queue")
  .option("--status <status>", `Job status (${jobStatusValues.join(", ")})`)
  .option("--limit <n>", "Limit number of jobs")
  .action(list);

jobs
  .command("get")
  .description("Get a job by id")
  .requiredOption("--id <jobId>", "Job id")
  .action(get);

jobs
  .command("process")
  .description("Claim and process the next job in the default queue")
  .option("--lock-duration-ms <ms>", "Lock duration in milliseconds")
  .action(processJob);

jobs
  .command("retry")
  .description("Create a new pending job from a failed job")
  .requiredOption("--id <jobId>", "Failed job id")
  .action(retry);

jobs.command("recover-stale").description("Recover stale jobs").action(recoverStale);

jobs
  .command("clear")
  .description("Clear pending jobs")
  .option("--all", "Clear jobs of all statuses")
  .action(clear);

jobs
  .command("clear:all")
  .description("Clear all jobs")
  .action((options) => clear({ ...options, all: true }));

jobs
  .command("cleanup")
  .description("Cleanup old completed and failed jobs")
  .option(
    "--completed-older-than-ms <ms>",
    "Delete completed jobs older than the provided milliseconds",
  )
  .option("--failed-older-than-ms <ms>", "Delete failed jobs older than the provided milliseconds")
  .action(cleanup);

program.parse();
