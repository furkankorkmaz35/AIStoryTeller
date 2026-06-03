import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const videoQueue = new Queue("video-pipeline", {
  connection: redisConnection
});

const options = { removeOnComplete: 50, removeOnFail: 50 };

// Every pipeline step is a small BullMQ job, so failures are visible in logs and retryable.
async function enqueue(name: string, projectId: string) {
  await videoQueue.add(name, { projectId }, options);
}

export const enqueueStoryGeneration = (projectId: string) => enqueue("generate-story", projectId);
export const enqueueScenesAndPrompts = (projectId: string) => enqueue("generate-scenes-and-prompts", projectId);
export const enqueueVisualCandidates = (projectId: string) => enqueue("generate-visual-candidates", projectId);
export const enqueueMaterialSelection = (projectId: string) => enqueue("select-best-materials", projectId);
export const enqueueAudioGeneration = (projectId: string) => enqueue("generate-audio", projectId);
export const enqueueSubtitleGeneration = (projectId: string) => enqueue("generate-subtitles", projectId);
export const enqueueVideoRender = (projectId: string) => enqueue("render-video", projectId);
