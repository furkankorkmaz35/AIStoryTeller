import { Queue } from "bullmq";
import { redisConnection } from "../config/redis.js";

export const videoQueue = new Queue("video-pipeline", {
  connection: redisConnection
});

const options = { removeOnComplete: 50, removeOnFail: 50 };

async function enqueue(name: string, projectId: string) {
  await videoQueue.add(name, { projectId }, options);
}

export const enqueueStoryGeneration = (projectId: string) => enqueue("generate-story", projectId);
export const enqueueScenesAndPrompts = (projectId: string) => enqueue("generate-scenes-and-prompts", projectId);
export const enqueueVariantTranslation = (projectId: string) => enqueue("translate-variants", projectId);
export const enqueueVisualCandidates = (projectId: string) => enqueue("generate-visual-candidates", projectId);
export const enqueueMaterialSelection = (projectId: string) => enqueue("select-best-materials", projectId);
export const enqueueAudioVariants = (projectId: string) => enqueue("generate-audio-variants", projectId);
export const enqueueSubtitleGeneration = (projectId: string) => enqueue("generate-subtitles", projectId);
export const enqueueBgmSelection = (projectId: string) => enqueue("select-bgm", projectId);
export const enqueueVideoVariants = (projectId: string) => enqueue("render-video-variants", projectId);
export const enqueueSocialExport = (projectId: string) => enqueue("prepare-social-export", projectId);

export const enqueueImageGeneration = enqueueVisualCandidates;
export const enqueueAudioGeneration = enqueueAudioVariants;
export const enqueueVideoRender = enqueueVideoVariants;

export const enqueueImportedProjectContinuation = enqueueMaterialSelection;
