import { Worker } from "bullmq";
import { connectDatabase } from "./config/db.js";
import { redisConnection } from "./config/redis.js";
import { ProjectModel } from "./models/project.js";
import { SceneModel } from "./models/scene.js";
import { AssetModel } from "./models/asset.js";
import { generateStory } from "./services/storyService.js";
import { generateSceneImage } from "./services/imageService.js";
import { generateNarration } from "./services/audioService.js";
import { renderProjectVideo } from "./services/videoService.js";
import { logJob } from "./services/jobLog.js";
import { enqueueAudioGeneration, enqueueImageGeneration, enqueueVideoRender } from "./queues/videoQueue.js";

await connectDatabase();

const worker = new Worker(
  "video-pipeline",
  async (job) => {
    const projectId = job.data.projectId as string;
    try {
      if (job.name === "generate-story") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_story" });
        await logJob(projectId, "story", "running", "Hikaye uretimi basladi.");
        const project = await ProjectModel.findById(projectId).orFail();
        const generated = await generateStory(project.theme, project.style, project.ageGroup, project.sceneCount);
        project.title = generated.title;
        project.story = generated.story;
        await project.save();
        await SceneModel.deleteMany({ projectId });
        await SceneModel.insertMany(
          generated.scenes.map((text, index) => ({
            projectId,
            order: index + 1,
            text,
            subtitle: text,
            status: "ready"
          }))
        );
        await logJob(projectId, "story", "completed", "Hikaye ve sahneler hazirlandi.");
        await enqueueImageGeneration(projectId);
      }

      if (job.name === "generate-images") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_images" });
        await logJob(projectId, "images", "running", "Sahne gorselleri uretiliyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
        await AssetModel.deleteMany({ projectId, type: "image" });
        for (const scene of scenes) {
          const generated = await generateSceneImage(projectId, scene.order, scene.text, project.style);
          scene.imagePrompt = generated.prompt;
          scene.imagePath = generated.imagePath;
          scene.status = "ready";
          await scene.save();
          await AssetModel.create({ projectId, sceneId: scene._id, type: "image", path: generated.imagePath, provider: generated.provider });
        }
        await logJob(projectId, "images", "completed", `${scenes.length} sahne gorseli hazirlandi.`);
        await enqueueAudioGeneration(projectId);
      }

      if (job.name === "generate-audio") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_audio" });
        await logJob(projectId, "audio", "running", "Seslendirme uretiliyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        await AssetModel.deleteMany({ projectId, type: "audio" });
        const generated = await generateNarration(projectId, project.story);
        await AssetModel.create({ projectId, type: "audio", path: generated.audioPath, provider: generated.provider });
        await logJob(projectId, "audio", "completed", "Seslendirme dosyasi hazirlandi.");
        await enqueueVideoRender(projectId);
      }

      if (job.name === "render-video") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "rendering_video" });
        await logJob(projectId, "video", "running", "Remotion video render basladi.");
        const project = await ProjectModel.findById(projectId).orFail();
        const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
        const audio = await AssetModel.findOne({ projectId, type: "audio" }).orFail();
        await AssetModel.deleteMany({ projectId, type: "video" });
        const videoPath = await renderProjectVideo(projectId, {
          title: project.title,
          story: project.story,
          audioPath: audio.path,
          scenes: scenes.map((scene) => ({
            text: scene.text,
            subtitle: scene.subtitle,
            imagePath: scene.imagePath
          }))
        });
        await AssetModel.create({ projectId, type: "video", path: videoPath, provider: "remotion" });
        await ProjectModel.findByIdAndUpdate(projectId, { status: "completed", videoPath });
        await logJob(projectId, "video", "completed", "MP4 video hazir.");
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Bilinmeyen worker hatasi";
      const message = rawMessage.length > 420 ? `${rawMessage.slice(0, 420)}...` : rawMessage;
      await ProjectModel.findByIdAndUpdate(projectId, { status: "failed", errorMessage: message });
      await logJob(projectId, job.name, "failed", message);
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

worker.on("ready", () => console.log("Video worker ready."));
worker.on("failed", (job, error) => console.error(`Job failed: ${job?.name}`, error));
