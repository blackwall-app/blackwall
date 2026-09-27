import "../../test/env.test";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Effect, Fiber, References } from "effect";
import { cleanupTestDb, createTestDb, type TestDb } from "../../test/setup";
import { jobService } from "../../job.service";

const startWorker = () =>
  Effect.runFork(
    jobService
      .runWorker({ queue: "worker-queue", pollIntervalMs: 5 })
      .pipe(Effect.provideService(References.MinimumLogLevel, "None")),
  );

const stopWorker = (fiber: ReturnType<typeof startWorker>) =>
  Effect.runPromise(Fiber.interrupt(fiber));

describe("jobService", () => {
  let testDb: TestDb;

  beforeEach(async () => {
    testDb = await createTestDb();
    jobService.clearHandlers();
  });

  afterEach(() => {
    cleanupTestDb(testDb);
    jobService.clearHandlers();
  });

  describe("processJob", () => {
    it("processes a queued job with its registered handler", async () => {
      let handlerCalled = false;
      let receivedPayload: unknown = null;

      jobService.registerHandler("test-handler", async (payload) => {
        handlerCalled = true;
        receivedPayload = payload;
      });

      await jobService.addJob({
        type: "test-handler",
        payload: { message: "hello" },
        queue: "test-queue",
      });

      const result = await jobService.processJob("test-queue");

      expect(result).not.toBeNull();
      expect(result!.success).toBe(true);
      expect(handlerCalled).toBe(true);
      expect(receivedPayload).toEqual({ message: "hello" });

      const job = await jobService.getJobById(result!.job.id);
      expect(job?.status).toBe("completed");
    });

    it("fails a job when no handler is registered", async () => {
      await jobService.addJob({
        type: "unregistered-type",
        payload: {},
        queue: "test-queue",
        maxAttempts: 1,
      });

      const result = await jobService.processJob("test-queue");

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain("No handler registered");

      const job = await jobService.getJobById(result!.job.id);
      expect(job?.status).toBe("failed");
      expect(job?.lastError).toContain("No handler registered");
    });

    it("fails a job when the handler throws", async () => {
      jobService.registerHandler("failing-handler", async () => {
        throw new Error("Something went wrong");
      });

      await jobService.addJob({
        type: "failing-handler",
        payload: {},
        queue: "test-queue",
        maxAttempts: 1,
      });

      const result = await jobService.processJob("test-queue");

      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toBe("Something went wrong");

      const job = await jobService.getJobById(result!.job.id);
      expect(job?.status).toBe("failed");
      expect(job?.lastError).toBe("Something went wrong");
    });

    it("returns null when the queue is empty", async () => {
      const result = await jobService.processJob("empty-queue");

      expect(result).toBeNull();
    });

    it("processes jobs in FIFO order", async () => {
      const processedOrder: number[] = [];

      jobService.registerHandler<{ order: number }>("order-test", async (payload) => {
        processedOrder.push(payload.order);
      });

      await jobService.addJob({ type: "order-test", payload: { order: 1 }, queue: "order-queue" });
      await jobService.addJob({ type: "order-test", payload: { order: 2 }, queue: "order-queue" });
      await jobService.addJob({ type: "order-test", payload: { order: 3 }, queue: "order-queue" });

      await jobService.processJob("order-queue");
      await jobService.processJob("order-queue");
      await jobService.processJob("order-queue");

      expect(processedOrder).toEqual([1, 2, 3]);
    });

    it("only processes jobs from the requested queue", async () => {
      let handlerCalled = false;

      jobService.registerHandler("queue-test", async () => {
        handlerCalled = true;
      });

      await jobService.addJob({ type: "queue-test", payload: {}, queue: "queue-a" });

      const wrongQueueResult = await jobService.processJob("queue-b");
      const rightQueueResult = await jobService.processJob("queue-a");

      expect(wrongQueueResult).toBeNull();
      expect(handlerCalled).toBe(true);
      expect(rightQueueResult).not.toBeNull();
    });

    it("marks a job as failed after exhausting maxAttempts", async () => {
      let attemptCount = 0;

      jobService.registerHandler("retry-test", async () => {
        attemptCount++;
        throw new Error("Fail on purpose");
      });

      await jobService.addJob({
        type: "retry-test",
        payload: {},
        queue: "retry-queue",
        maxAttempts: 1,
      });

      await jobService.processJob("retry-queue");

      const jobs = await jobService.listJobs({ queue: "retry-queue", status: "failed" });

      expect(attemptCount).toBe(1);
      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.lastError).toBe("Fail on purpose");
    });

    it("returns a job to pending with backoff when retries remain", async () => {
      jobService.registerHandler("backoff-test", async () => {
        throw new Error("Temporary failure");
      });

      await jobService.addJob({
        type: "backoff-test",
        payload: {},
        queue: "backoff-queue",
        maxAttempts: 3,
      });

      await jobService.processJob("backoff-queue");

      const [job] = await jobService.listJobs({ queue: "backoff-queue" });

      expect(job?.status).toBe("pending");
      expect(job?.attempts).toBe(1);
      expect(job?.runAt).not.toBeNull();
      expect(job!.runAt!.getTime()).toBeGreaterThan(Date.now());
    });

    it("creates a new default-queue job when retrying a failed job", async () => {
      jobService.registerHandler("retry-manual-test", async () => {
        throw new Error("Fail once");
      });

      const originalJob = await jobService.addJob({
        type: "retry-manual-test",
        payload: { value: 42 },
        queue: "email",
        maxAttempts: 1,
      });

      await jobService.processJob("email");

      const failedJob = await jobService.getJobById(originalJob.id);
      expect(failedJob?.status).toBe("failed");

      const retriedJob = await jobService.retryFailedJob(originalJob.id);

      expect(retriedJob.id).not.toBe(originalJob.id);
      expect(retriedJob.queue).toBe("default");
      expect(retriedJob.type).toBe(originalJob.type);
      expect(retriedJob.payload).toBe(originalJob.payload);
      expect(retriedJob.status).toBe("pending");
      expect(retriedJob.attempts).toBe(0);

      const failedJobAfterRetry = await jobService.getJobById(originalJob.id);
      expect(failedJobAfterRetry?.status).toBe("failed");
      expect(failedJobAfterRetry?.lastError).toBe("Fail once");
    });

    it("rejects retrying a job that is not failed", async () => {
      const job = await jobService.addJob({
        type: "pending-job",
        payload: { value: 1 },
      });

      await expect(jobService.retryFailedJob(job.id)).rejects.toThrow(
        `Only failed jobs can be retried: ${job.id}`,
      );
    });
  });

  describe("runWorker", () => {
    it("processes queued jobs", async () => {
      const processed: number[] = [];
      const done = Promise.withResolvers<void>();

      jobService.registerHandler<{ n: number }>("worker-test", async (payload) => {
        processed.push(payload.n);
        if (processed.length === 2) done.resolve();
      });

      const fiber = startWorker();
      await jobService.addJob({ type: "worker-test", payload: { n: 1 }, queue: "worker-queue" });
      await jobService.addJob({ type: "worker-test", payload: { n: 2 }, queue: "worker-queue" });
      await done.promise;
      await stopWorker(fiber);

      expect(processed).toEqual([1, 2]);
      const jobs = await jobService.listJobs({ queue: "worker-queue", status: "completed" });
      expect(jobs).toHaveLength(2);
    });

    it("keeps polling after a job fails", async () => {
      const done = Promise.withResolvers<void>();

      jobService.registerHandler("worker-fail", async () => {
        throw new Error("Boom");
      });
      jobService.registerHandler("worker-ok", async () => {
        done.resolve();
      });

      const failing = await jobService.addJob({
        type: "worker-fail",
        payload: {},
        queue: "worker-queue",
        maxAttempts: 1,
      });
      const retrying = await jobService.addJob({
        type: "worker-fail",
        payload: {},
        queue: "worker-queue",
        maxAttempts: 3,
      });
      const unhandled = await jobService.addJob({
        type: "worker-unregistered",
        payload: {},
        queue: "worker-queue",
        maxAttempts: 1,
      });
      await jobService.addJob({ type: "worker-ok", payload: {}, queue: "worker-queue" });

      const fiber = startWorker();
      await done.promise;
      await stopWorker(fiber);

      const failed = await jobService.getJobById(failing.id);
      expect(failed?.status).toBe("failed");
      expect(failed?.lastError).toBe("Boom");

      const retried = await jobService.getJobById(retrying.id);
      expect(retried?.status).toBe("pending");
      expect(retried?.attempts).toBe(1);
      expect(retried!.runAt!.getTime()).toBeGreaterThan(Date.now());

      const unhandledJob = await jobService.getJobById(unhandled.id);
      expect(unhandledJob?.status).toBe("failed");
      expect(unhandledJob?.lastError).toContain("No handler registered");
    });

    it("recovers stale jobs on startup", async () => {
      const done = Promise.withResolvers<void>();
      jobService.registerHandler("worker-stale", async () => {
        done.resolve();
      });

      const job = await jobService.addJob({
        type: "worker-stale",
        payload: {},
        queue: "worker-queue",
      });
      await jobService.claimJob("worker-queue", -1000);

      const fiber = startWorker();
      await done.promise;
      await stopWorker(fiber);

      const recovered = await jobService.getJobById(job.id);
      expect(recovered?.status).toBe("completed");
      expect(recovered?.attempts).toBe(2);
    });

    it("waits for the in-flight job before stopping", async () => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();

      jobService.registerHandler("worker-slow", async () => {
        started.resolve();
        await release.promise;
      });

      const job = await jobService.addJob({
        type: "worker-slow",
        payload: {},
        queue: "worker-queue",
      });

      const fiber = startWorker();
      await started.promise;

      let stopped = false;
      const stopping = stopWorker(fiber).then(() => {
        stopped = true;
      });
      await Bun.sleep(20);
      expect(stopped).toBe(false);

      release.resolve();
      await stopping;

      const completed = await jobService.getJobById(job.id);
      expect(completed?.status).toBe("completed");
    });
  });
});
