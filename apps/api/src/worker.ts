import { Worker } from "bullmq";
import { connectDatabase } from "./config/db.js";
import { redisConnection } from "./config/redis.js";
import { ProjectModel } from "./models/project.js";
import { logJob } from "./services/jobLog.js";
import { runPipelineStep } from "./services/pipelineService.js";

await connectDatabase();

// Worker is deliberately thin: BullMQ receives jobs, pipelineService performs the real work.
const worker = new Worker(
  "video-pipeline",
  async (job) => {
    const projectId = job.data.projectId as string;
    try {
      await runPipelineStep(job.name, projectId);
    } catch (error) {
      await markProjectAsFailed(projectId, job.name, error);
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

// Stores failures in MongoDB so the frontend can show a clear status instead of hanging forever.
async function markProjectAsFailed(projectId: string, stepName: string, error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "Bilinmeyen worker hatası";
  const message = rawMessage.length > 420 ? `${rawMessage.slice(0, 420)}...` : rawMessage;
  await ProjectModel.findByIdAndUpdate(projectId, { status: "failed", errorMessage: message });
  await logJob(projectId, stepName, "failed", message);
}

worker.on("ready", () => console.log("Video worker ready."));
worker.on("failed", (job, error) => console.error(`Job failed: ${job?.name}`, error));
