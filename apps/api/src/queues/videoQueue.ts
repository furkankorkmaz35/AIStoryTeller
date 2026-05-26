import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const videoQueue = new Queue("video-pipeline", {
  connection: redisConnection
});

export async function enqueueStoryGeneration(projectId: string) {
  await videoQueue.add("generate-story", { projectId }, { removeOnComplete: 50, removeOnFail: 50 });
}

export async function enqueueImageGeneration(projectId: string) {
  await videoQueue.add("generate-images", { projectId }, { removeOnComplete: 50, removeOnFail: 50 });
}

export async function enqueueAudioGeneration(projectId: string) {
  await videoQueue.add("generate-audio", { projectId }, { removeOnComplete: 50, removeOnFail: 50 });
}

export async function enqueueVideoRender(projectId: string) {
  await videoQueue.add("render-video", { projectId }, { removeOnComplete: 50, removeOnFail: 50 });
}
