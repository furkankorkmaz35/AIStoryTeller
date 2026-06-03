import fs from "node:fs/promises";
import path from "node:path";
import { Worker } from "bullmq";
import { connectDatabase } from "./config/db.js";
import { redisConnection } from "./config/redis.js";
import { ProjectModel } from "./models/project.js";
import { ProjectVariantModel } from "./models/projectVariant.js";
import { SceneModel } from "./models/scene.js";
import { AssetModel } from "./models/asset.js";
import { buildVisualProfile, generateExportCopy, generateLanguageVariants, generateScenePlans, generateStory, supportedLanguages, type LanguageCode } from "./services/storyService.js";
import { generateSceneMaterial } from "./services/imageService.js";
import { generateSceneNarration } from "./services/audioService.js";
import { renderProjectVideo } from "./services/videoService.js";
import { logJob } from "./services/jobLog.js";
import { ensureProjectOutput, publicPathFor } from "./utils/paths.js";
import {
  enqueueAudioVariants,
  enqueueBgmSelection,
  enqueueMaterialSelection,
  enqueueScenesAndPrompts,
  enqueueSocialExport,
  enqueueSubtitleGeneration,
  enqueueVariantTranslation,
  enqueueVideoVariants,
  enqueueVisualCandidates
} from "./queues/videoQueue.js";

await connectDatabase();

const worker = new Worker(
  "video-pipeline",
  async (job) => {
    const projectId = job.data.projectId as string;
    try {
      if (job.name === "generate-story") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_story", errorMessage: "" });
        await logJob(projectId, "story", "running", "Groq/Gemini/fallback ile hikaye üretimi başladı.");
        const project = await ProjectModel.findById(projectId).orFail();
        const generated = await generateStory(project.theme, project.style, project.ageGroup, project.sceneCount);
        project.title = generated.title;
        project.story = generated.story;
        project.visualProfile = buildVisualProfile(project.theme, project.style);
        await project.save();
        await SceneModel.deleteMany({ projectId });
        await SceneModel.insertMany(
          generated.scenes.map((text, index) => ({
            projectId,
            order: index + 1,
            text,
            subtitle: text,
            status: "story-ready"
          }))
        );
        await logJob(projectId, "story", "completed", "Hikaye ve temel sahne yapısı hazırlandı.");
        await enqueueScenesAndPrompts(projectId);
      }

      if (job.name === "generate-scenes-and-prompts") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_scenes" });
        await logJob(projectId, "prompts", "running", "Sahne promptları ve stok medya terimleri hazırlanıyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
        const plans = await generateScenePlans(project.theme, project.style, scenes.map((scene) => scene.text));
        for (const [index, scene] of scenes.entries()) {
          const plan = plans[index];
          scene.visualPrompt = plan.visualPrompt;
          scene.imagePrompt = plan.visualPrompt;
          scene.negativePrompt = plan.negativePrompt;
          scene.searchTerms = plan.searchTerms;
          scene.status = "prompt-ready";
          await scene.save();
        }
        await logJob(projectId, "prompts", "completed", `${scenes.length} sahne için cloud image ve stok arama planı hazır.`);
        await enqueueVariantTranslation(projectId);
      }

      if (job.name === "translate-variants") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "translating_variants" });
        await logJob(projectId, "variants", "running", "Türkçe, İngilizce, Almanca ve İspanyolca varyantlar hazırlanıyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const languages = normalizeLanguages(project.languages);
        const story = { title: project.title, story: project.story, scenes: (await SceneModel.find({ projectId }).sort({ order: 1 })).map((scene) => scene.text) };
        const variants = await generateLanguageVariants(story, languages, project.targetPlatform);
        await ProjectVariantModel.deleteMany({ projectId });
        await ProjectVariantModel.insertMany(
          variants.map((variant) => ({
            projectId,
            language: variant.language,
            title: variant.title,
            story: variant.story,
            status: "queued",
            exportCaption: variant.exportCaption,
            exportHashtags: variant.exportHashtags,
            metadata: { scenes: variant.scenes }
          }))
        );
        await logJob(projectId, "variants", "completed", `${variants.length} dil varyantı hazırlandı.`);
        if (project.creationMode === "studio-import") {
          await ProjectModel.findByIdAndUpdate(projectId, { status: "awaiting_import" });
          await logJob(projectId, "import", "running", "Studio Import modu: sahne promptları hazır. Görsel veya video klip içe aktarımı bekleniyor.");
          return;
        }
        await enqueueVisualCandidates(projectId);
      }

      if (job.name === "generate-visual-candidates") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_visuals" });
        await logJob(projectId, "visuals", "running", "Cloud/free-tier görsel ve stok medya adayları deneniyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
        await AssetModel.deleteMany({ projectId, type: { $in: ["image", "stock-image"] } });
        for (const scene of scenes) {
          const generated = await generateSceneMaterial(
            projectId,
            scene.order,
            `${project.theme}\nScene ${scene.order}: ${scene.text}`,
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
          scene.status = "material-ready";
          await scene.save();
          if (scene.order === 1) {
            await ProjectModel.findByIdAndUpdate(projectId, { thumbnailPath: generated.imagePath });
          }
          await AssetModel.create({
            projectId,
            sceneId: scene._id,
            type: generated.materialType === "stock-image" ? "stock-image" : "image",
            path: generated.imagePath,
            provider: generated.provider,
            metadata: generated.metadata
          });
          await logJob(projectId, "visuals", "completed", `Sahne ${scene.order}: ${generated.provider} seçildi. Kalite: ${generated.metadata.qualityScore}/100.`);
        }
        await enqueueMaterialSelection(projectId);
      }

      if (job.name === "select-best-materials") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "selecting_materials" });
        await logJob(projectId, "materials", "completed", "Görsel kalite kontrolü tamamlandı; ortak materyaller dil varyantlarıyla paylaşılacak.");
        await enqueueAudioVariants(projectId);
      }

      if (job.name === "generate-audio-variants") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_audio" });
        await logJob(projectId, "audio", "running", "Seçilen ElevenLabs sesiyle anlatım hazırlanıyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
        const variants = await ProjectVariantModel.find({ projectId }).sort({ language: 1 });
        await AssetModel.deleteMany({ projectId, type: "audio" });
        for (const variant of variants) {
          variant.status = "audio";
          await variant.save();
          const translatedScenes = Array.isArray(variant.metadata?.scenes) ? (variant.metadata.scenes as string[]) : [];
          const sceneNarrationTexts = scenes.map((scene) => translatedScenes[scene.order - 1] || scene.subtitle || scene.text);
          const generated = await generateSceneNarration(
            projectId,
            sceneNarrationTexts,
            variant.language as LanguageCode,
            project.voiceProvider,
            project.elevenLabsVoiceId
          );
          variant.audioPath = generated.audioPath;
          variant.metadata = {
            ...(variant.metadata || {}),
            sceneAudioDurations: generated.sceneDurationsSeconds,
            sceneNarrationTexts: sceneNarrationTexts.map((text) => cleanNarrationLine(text))
          };
          await variant.save();
          await AssetModel.create({ projectId, type: "audio", path: generated.audioPath, provider: generated.provider, metadata: { language: variant.language } });
          await logJob(projectId, "audio", "completed", `${variant.language}: ${generated.provider} ses dosyası hazır.`);
        }
        await enqueueSubtitleGeneration(projectId);
      }

      if (job.name === "generate-subtitles") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_subtitles" });
        const project = await ProjectModel.findById(projectId).orFail();
        if (!project.subtitlesEnabled) {
          await AssetModel.deleteMany({ projectId, type: "subtitle" });
          await logJob(projectId, "subtitles", "completed", "Altyazı kapalı; render sadece görsel ve ses akışıyla devam edecek.");
          await enqueueBgmSelection(projectId);
          return;
        }
        await logJob(projectId, "subtitles", "running", "Altyazı metinleri dil varyantlarına göre hazırlanıyor.");
        const projectDir = await ensureProjectOutput(projectId);
        const variants = await ProjectVariantModel.find({ projectId }).sort({ language: 1 });
        await AssetModel.deleteMany({ projectId, type: "subtitle" });
        for (const variant of variants) {
          variant.status = "subtitles";
          await variant.save();
          const filename = `subtitles-${variant.language}.json`;
          await fs.writeFile(
            path.join(projectDir, filename),
            JSON.stringify({ language: variant.language, story: variant.story, scenes: variant.metadata?.sceneNarrationTexts ?? variant.metadata?.scenes ?? [] }, null, 2),
            "utf8"
          );
          await AssetModel.create({ projectId, type: "subtitle", path: publicPathFor(projectId, filename), provider: "generated", metadata: { language: variant.language } });
        }
        await logJob(projectId, "subtitles", "completed", "Dil bazlı altyazı içerikleri hazır.");
        await enqueueBgmSelection(projectId);
      }

      if (job.name === "select-bgm") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "selecting_bgm" });
        await logJob(projectId, "bgm", "completed", "BGM seçimi şimdilik Remotion atmosfer katmanıyla temsil ediliyor.");
        await enqueueVideoVariants(projectId);
      }

      if (job.name === "render-video-variants") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "rendering_video" });
        await logJob(projectId, "video", "running", "Remotion ile her dil için ayrı MP4 render başlıyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
        const variants = await ProjectVariantModel.find({ projectId }).sort({ language: 1 });
        await AssetModel.deleteMany({ projectId, type: "video" });
        for (const variant of variants) {
          variant.status = "rendering";
          await variant.save();
          const translatedScenes = Array.isArray(variant.metadata?.scenes) ? (variant.metadata.scenes as string[]) : [];
          const sceneNarrationTexts = Array.isArray(variant.metadata?.sceneNarrationTexts) ? (variant.metadata.sceneNarrationTexts as string[]) : [];
          const sceneAudioDurations = Array.isArray(variant.metadata?.sceneAudioDurations) ? (variant.metadata.sceneAudioDurations as number[]) : [];
          const videoPath = await renderProjectVideo(
            projectId,
            {
              title: variant.title || project.title,
              story: variant.story || project.story,
              audioPath: variant.audioPath,
              aspectRatio: project.aspectRatio,
              language: variant.language,
              subtitlesEnabled: project.subtitlesEnabled,
              sceneDurationsInFrames: sceneAudioDurations.map((seconds) => Math.ceil((Number(seconds) + 0.42) * 30)),
              scenes: scenes.map((scene) => ({
                text: scene.text,
                subtitle: shortSubtitle(sceneNarrationTexts[scene.order - 1] || translatedScenes[scene.order - 1] || scene.subtitle || scene.text),
                imagePath: scene.imagePath,
                videoPath: scene.videoPath,
                materialType: scene.materialType
              }))
            },
            `final-${variant.language}.mp4`
          );
          variant.videoPath = videoPath;
          await variant.save();
          await AssetModel.create({ projectId, type: "video", path: videoPath, provider: "remotion", metadata: { language: variant.language } });
          await logJob(projectId, "video", "completed", `${variant.language}: MP4 video hazır.`);
        }
        const firstVideo = variants[0]?.videoPath || "";
        await ProjectModel.findByIdAndUpdate(projectId, { videoPath: firstVideo });
        await enqueueSocialExport(projectId);
      }

      if (job.name === "prepare-social-export") {
        await ProjectModel.findByIdAndUpdate(projectId, { status: "preparing_export" });
        await logJob(projectId, "export", "running", "Sosyal medya caption, hashtag ve metadata export hazırlanıyor.");
        const project = await ProjectModel.findById(projectId).orFail();
        const projectDir = await ensureProjectOutput(projectId);
        const variants = await ProjectVariantModel.find({ projectId }).sort({ language: 1 });
        await AssetModel.deleteMany({ projectId, type: "export" });
        for (const variant of variants) {
          variant.status = "exporting";
          const copy = await generateExportCopy(variant.title || project.title, variant.story || project.story, variant.language as LanguageCode, project.targetPlatform);
          variant.exportCaption = copy.caption;
          variant.exportHashtags = copy.hashtags;
          variant.status = "completed";
          await variant.save();
          const filename = `export-${variant.language}.json`;
          await fs.writeFile(
            path.join(projectDir, filename),
            JSON.stringify(
              {
                language: variant.language,
                platform: project.targetPlatform,
                title: variant.title,
                caption: variant.exportCaption,
                hashtags: variant.exportHashtags,
                videoPath: variant.videoPath
              },
              null,
              2
            ),
            "utf8"
          );
          await AssetModel.create({ projectId, type: "export", path: publicPathFor(projectId, filename), provider: "social-export", metadata: { language: variant.language } });
        }
        await ProjectModel.findByIdAndUpdate(projectId, { status: "completed", errorMessage: "" });
        await logJob(projectId, "export", "completed", "Tüm dil varyantları ve sosyal medya export paketleri hazır.");
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Bilinmeyen worker hatası";
      const message = rawMessage.length > 420 ? `${rawMessage.slice(0, 420)}...` : rawMessage;
      await ProjectModel.findByIdAndUpdate(projectId, { status: "failed", errorMessage: message });
      await logJob(projectId, job.name, "failed", message);
      throw error;
    }
  },
  { connection: redisConnection, concurrency: 1 }
);

function normalizeLanguages(value: unknown): LanguageCode[] {
  const input = Array.isArray(value) ? value : [];
  const filtered = input.filter((language): language is LanguageCode => supportedLanguages.includes(language as LanguageCode));
  return filtered.length ? filtered : supportedLanguages;
}

function shortSubtitle(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const withoutSceneLabel = firstSentence.replace(/^sahne\s*\d+\s*[:.-]?\s*/i, "");
  if (withoutSceneLabel.length <= 82) return withoutSceneLabel;
  const cut = withoutSceneLabel.slice(0, 82);
  const breakPoint = Math.max(cut.lastIndexOf(" "), 48);
  return `${cut.slice(0, breakPoint).trim()}...`;
}

function buildNarrationScript(values: string[]) {
  const script = values.map((value) => cleanNarrationLine(value)).filter(Boolean).join(". ");
  if (!script) return "Video anlatımı hazırlanıyor.";
  return /[.!?]$/.test(script) ? script : `${script}.`;
}

function cleanNarrationLine(value: string) {
  return value
    .replace(/^\s*(sahne|scene)\s*\d+\s*[:.-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/g, "");
}

worker.on("ready", () => console.log("Video worker ready."));
worker.on("failed", (job, error) => console.error(`Job failed: ${job?.name}`, error));
