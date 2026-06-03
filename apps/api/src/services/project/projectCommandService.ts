import { ProjectModel } from "../../models/project.js";
import { enqueueStoryGeneration } from "../../queues/videoQueue.js";
import { logJob } from "../jobLog.js";
import { buildVisualProfile } from "../storyService.js";
import type { createProjectSchema } from "../../validators/projectSchemas.js";
import type { z } from "zod";

type CreateProjectInput = z.infer<typeof createProjectSchema>;

export async function createQueuedProject(input: CreateProjectInput) {
  // Demo quality is more stable with three short scenes: fewer visuals, tighter audio sync.
  const sceneCount = 3;
  const project = await ProjectModel.create({
    ...input,
    sceneCount,
    ageGroup: "genel sosyal medya izleyicisi",
    title: `${input.theme} Video Hikayesi`,
    visualProfile: buildVisualProfile(input.theme, input.style),
    status: "queued"
  });
  await logJob(project.id, "queue", "queued", "Video uretim pipeline'i kuyruga alindi.");
  await enqueueStoryGeneration(project.id);
  return project;
}
