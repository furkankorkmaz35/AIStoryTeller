import { Router } from "express";
import { z } from "zod";
import { ProjectModel } from "../models/project.js";
import { SceneModel } from "../models/scene.js";
import { AssetModel } from "../models/asset.js";
import { JobEventModel } from "../models/jobEvent.js";
import { enqueueStoryGeneration } from "../queues/videoQueue.js";
import { logJob } from "../services/jobLog.js";

const router = Router();

const createProjectSchema = z.object({
  theme: z.string().trim().min(2),
  style: z.enum(["storybook", "cartoon", "cinematic", "educational"]).default("cinematic"),
  ageGroup: z.string().trim().min(2).default("7-10"),
  sceneCount: z.coerce.number().int().min(3).max(6).default(3)
});

router.post("/", async (request, response, next) => {
  try {
    const body = createProjectSchema.parse(request.body);
    const project = await ProjectModel.create({
      ...body,
      title: `${body.theme} Video Hikayesi`,
      status: "queued"
    });
    await logJob(project.id, "queue", "queued", "Video uretim pipeline'i kuyruga alindi.");
    await enqueueStoryGeneration(project.id);
    response.status(201).json(project);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (_request, response, next) => {
  try {
    const projects = await ProjectModel.find().sort({ createdAt: -1 }).limit(50);
    response.json(projects);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    const { id } = request.params;
    const [project, scenes, assets, events] = await Promise.all([
      ProjectModel.findById(id),
      SceneModel.find({ projectId: id }).sort({ order: 1 }),
      AssetModel.find({ projectId: id }).sort({ createdAt: 1 }),
      JobEventModel.find({ projectId: id }).sort({ createdAt: 1 })
    ]);
    if (!project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    response.json({ project, scenes, assets, events });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/retry", async (request, response, next) => {
  try {
    const project = await ProjectModel.findByIdAndUpdate(
      request.params.id,
      { status: "queued", errorMessage: "" },
      { new: true }
    );
    if (!project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    await logJob(project.id, "queue", "queued", "Proje yeniden kuyruga alindi.");
    await enqueueStoryGeneration(project.id);
    response.json(project);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/events", async (request, response, next) => {
  try {
    const events = await JobEventModel.find({ projectId: request.params.id }).sort({ createdAt: 1 });
    response.json(events);
  } catch (error) {
    next(error);
  }
});

export { router as projectsRouter };
