import type { Job } from "@blackwall/queue";

function parseJsonArg(value: string, label: string) {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(
      `Invalid JSON for ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function formatJob(job: Job) {
  if (typeof job.payload === "string") {
    try {
      return { ...job, payload: JSON.parse(job.payload) };
    } catch {
      return job;
    }
  }
  return job;
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

function parseNumber(value: string, label: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid number for ${label}: ${value}`);
  }
  return parsed;
}

export { parseJsonArg, formatJob, printJson, parseNumber };
