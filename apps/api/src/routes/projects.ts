import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ProjectModel } from "../models/project.js";
import { SceneModel } from "../models/scene.js";
import { AssetModel } from "../models/asset.js";
import { JobEventModel } from "../models/jobEvent.js";
import { ProjectVariantModel } from "../models/projectVariant.js";
import { enqueueImportedProjectContinuation, enqueueStoryGeneration } from "../queues/videoQueue.js";
import { logJob } from "../services/jobLog.js";
import { supportedLanguages } from "../services/storyService.js";
import { generateSceneMaterial } from "../services/imageService.js";
import { buildVisualProfile } from "../services/storyService.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

const router = Router();

const createProjectSchema = z.object({
  theme: z.string().trim().min(2),
  style: z.enum(["storybook", "cartoon", "cinematic", "educational"]).default("cinematic"),
  ageGroup: z.string().trim().min(2).default("7-10"),
  sceneCount: z.coerce.number().int().min(0).max(6).default(0),
  sceneCountMode: z.enum(["auto", "manual"]).default("auto"),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  targetPlatform: z.enum(["tiktok", "reels", "shorts"]).default("tiktok"),
  creationMode: z.enum(["full-auto", "studio-import"]).default("full-auto"),
  languages: z.array(z.enum(["tr", "en", "de", "es"])).min(1).max(4).default(["tr"]),
  imageProvider: z.enum(["designed", "auto", "cloudflare", "pollinations", "huggingface", "stock"]).default("pollinations"),
  voiceProvider: z.enum(["auto", "azure", "edge", "elevenlabs"]).default("elevenlabs"),
  elevenLabsVoiceId: z.string().trim().optional().default(""),
  subtitlesEnabled: z.boolean().default(true),
  materialMode: z.enum(["hybrid-cloud", "ai-image", "stock-assisted"]).default("ai-image"),
  imageQuality: z.enum(["demo", "balanced", "high"]).default("balanced")
});

const importSceneVideoSchema = z.object({
  filename: z.string().trim().min(3).default("external-scene.mp4"),
  mimeType: z.string().trim().default("video/mp4"),
  dataUrl: z.string().min(100)
});

const importFullVideoSchema = importSceneVideoSchema;

router.post("/", async (request, response, next) => {
  try {
    const body = createProjectSchema.parse(request.body);
    const sceneCount = 3;
    const project = await ProjectModel.create({
      ...body,
      sceneCount,
      ageGroup: "genel sosyal medya izleyicisi",
      title: `${body.theme} Video Hikayesi`,
      visualProfile: buildVisualProfile(body.theme, body.style),
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
    const projects = await ProjectModel.find().sort({ createdAt: -1 }).limit(50).lean();
    const projectIds = projects.map((project) => project._id);
    const firstScenes = await SceneModel.find({ projectId: { $in: projectIds }, order: 1, imagePath: { $ne: "" } }).select("projectId imagePath").lean();
    const thumbnails = new Map(firstScenes.map((scene) => [String(scene.projectId), scene.imagePath]));
    response.json(projects.map((project) => ({ ...project, thumbnailPath: project.thumbnailPath || thumbnails.get(String(project._id)) || "" })));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (request, response, next) => {
  try {
    const { id } = request.params;
    const [project, scenes, assets, events, variants] = await Promise.all([
      ProjectModel.findById(id),
      SceneModel.find({ projectId: id }).sort({ order: 1 }),
      AssetModel.find({ projectId: id }).sort({ createdAt: 1 }),
      JobEventModel.find({ projectId: id }).sort({ createdAt: 1 }),
      ProjectVariantModel.find({ projectId: id }).sort({ language: 1 })
    ]);
    if (!project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    response.json({ project, scenes, assets, events, variants });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/export", async (request, response, next) => {
  try {
    const variants = await ProjectVariantModel.find({ projectId: request.params.id }).sort({ language: 1 });
    if (!variants.length) {
      response.status(404).json({ message: "Export not found" });
      return;
    }
    response.json({
      projectId: request.params.id,
      variants: variants.map((variant) => ({
        language: variant.language,
        title: variant.title,
        caption: variant.exportCaption,
        hashtags: variant.exportHashtags,
        videoPath: variant.videoPath
      }))
    });
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

router.post("/:id/scenes/:sceneId/regenerate", async (request, response, next) => {
  try {
    const [project, scene] = await Promise.all([
      ProjectModel.findById(request.params.id),
      SceneModel.findOne({ _id: request.params.sceneId, projectId: request.params.id })
    ]);
    if (!project || !scene) {
      response.status(404).json({ message: "Project or scene not found" });
      return;
    }

    await logJob(project.id, "visuals", "running", `Sahne ${scene.order} için görsel tekrar deneniyor.`);
    const generated = await generateSceneMaterial(
      project.id,
      scene.order,
      scene.text,
      project.style,
      {
        summary: scene.text.slice(0, 140),
        visualPrompt: scene.visualPrompt || scene.imagePrompt,
        negativePrompt: scene.negativePrompt,
        searchTerms: scene.searchTerms
      },
      project.materialMode,
      project.imageProvider
    );

    scene.imagePrompt = generated.prompt;
    scene.imagePath = generated.imagePath;
    scene.materialPath = generated.imagePath;
    scene.materialType = generated.materialType;
    scene.materialProvider = generated.provider;
    scene.materialQualityScore = generated.metadata.qualityScore;
    scene.materialQualityReason = generated.metadata.qualityReason;
    scene.status = "material-regenerated";
    await scene.save();
    await AssetModel.deleteMany({ projectId: project.id, sceneId: scene._id, type: { $in: ["image", "stock-image"] } });
    await AssetModel.create({
      projectId: project.id,
      sceneId: scene._id,
      type: generated.materialType === "stock-image" ? "stock-image" : "image",
      path: generated.imagePath,
      provider: generated.provider,
      metadata: { ...generated.metadata, regenerated: true }
    });
    await logJob(project.id, "visuals", "completed", `Sahne ${scene.order}: ${generated.provider} ile yeniden üretildi. Kalite: ${generated.metadata.qualityScore}/100.`);
    response.json(scene);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/scenes/:sceneId/import-video", async (request, response, next) => {
  try {
    const body = importSceneVideoSchema.parse(request.body);
    const [project, scene] = await Promise.all([
      ProjectModel.findById(request.params.id),
      SceneModel.findOne({ _id: request.params.sceneId, projectId: request.params.id })
    ]);
    if (!project || !scene) {
      response.status(404).json({ message: "Project or scene not found" });
      return;
    }
    if (!body.mimeType.startsWith("video/")) {
      response.status(400).json({ message: "Only video files are supported." });
      return;
    }

    const match = body.dataUrl.match(/^data:video\/[a-z0-9.+-]+;base64,(.+)$/i);
    if (!match) {
      response.status(400).json({ message: "Invalid video data URL." });
      return;
    }

    const extension = safeVideoExtension(body.filename, body.mimeType);
    const filename = `scene-${scene.order}-external-${Date.now()}.${extension}`;
    const projectDir = await ensureProjectOutput(project.id);
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.byteLength < 10_000) {
      response.status(400).json({ message: "Video file is too small." });
      return;
    }
    await fs.writeFile(path.join(projectDir, filename), bytes);

    const videoPath = publicPathFor(project.id, filename);
    scene.videoPath = videoPath;
    scene.materialPath = videoPath;
    scene.materialType = "external-video";
    scene.materialProvider = "manual-external-import";
    scene.materialQualityScore = 90;
    scene.materialQualityReason = "Kullanıcı tarafından dış video üretim aracından içe aktarıldı; Remotion final edit içinde doğrudan kullanılacak.";
    scene.status = "external-video-ready";
    await scene.save();

    await AssetModel.deleteMany({ projectId: project.id, sceneId: scene._id, type: "clip" });
    await AssetModel.create({
      projectId: project.id,
      sceneId: scene._id,
      type: "clip",
      path: videoPath,
      provider: "manual-external-import",
      metadata: {
        sceneOrder: scene.order,
        filename: body.filename,
        mimeType: body.mimeType,
        qualityScore: scene.materialQualityScore,
        qualityReason: scene.materialQualityReason
      }
    });
    await logJob(project.id, "visuals", "completed", `Sahne ${scene.order}: dış video klibi içe aktarıldı. Kalite: 90/100.`);
    response.json(scene);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/import-final-video", async (request, response, next) => {
  try {
    const body = importFullVideoSchema.parse(request.body);
    const project = await ProjectModel.findById(request.params.id);
    if (!project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    const match = body.dataUrl.match(/^data:video\/[a-z0-9.+-]+;base64,(.+)$/i);
    if (!body.mimeType.startsWith("video/") || !match) {
      response.status(400).json({ message: "Invalid video file." });
      return;
    }
    const extension = safeVideoExtension(body.filename, body.mimeType);
    const filename = `external-final-${Date.now()}.${extension}`;
    const projectDir = await ensureProjectOutput(project.id);
    const bytes = Buffer.from(match[1], "base64");
    if (bytes.byteLength < 10_000) {
      response.status(400).json({ message: "Video file is too small." });
      return;
    }
    await fs.writeFile(path.join(projectDir, filename), bytes);
    const videoPath = publicPathFor(project.id, filename);
    project.videoPath = videoPath;
    project.status = "completed";
    await project.save();
    await AssetModel.create({
      projectId: project.id,
      type: "video",
      path: videoPath,
      provider: "manual-final-import",
      metadata: { filename: body.filename, mimeType: body.mimeType, qualityScore: 92 }
    });
    await logJob(project.id, "import", "completed", "Komple dış video içe aktarıldı ve proje tamamlandı.");
    response.json(project);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/continue-import", async (request, response, next) => {
  try {
    const project = await ProjectModel.findById(request.params.id);
    if (!project) {
      response.status(404).json({ message: "Project not found" });
      return;
    }
    const scenes = await SceneModel.find({ projectId: project.id }).sort({ order: 1 });
    const missing = scenes.filter((scene) => !scene.videoPath && !scene.imagePath);
    if (missing.length) {
      response.status(400).json({ message: `${missing.length} sahne için materyal eksik.` });
      return;
    }
    project.status = "selecting_materials";
    await project.save();
    await logJob(project.id, "import", "completed", "İçe aktarılan materyaller onaylandı; final otomasyon devam ediyor.");
    await enqueueImportedProjectContinuation(project.id);
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

function safeVideoExtension(filename: string, mimeType: string) {
  const fromName = filename.split(".").pop()?.toLowerCase();
  if (fromName && ["mp4", "mov", "webm", "m4v"].includes(fromName)) return fromName;
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("quicktime")) return "mov";
  return "mp4";
}
