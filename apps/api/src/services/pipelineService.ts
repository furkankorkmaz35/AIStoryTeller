import fs from "node:fs/promises";
import path from "node:path";
import { AssetModel } from "../models/asset.js";
import { ProjectModel } from "../models/project.js";
import { SceneModel } from "../models/scene.js";
import {
  enqueueAudioGeneration,
  enqueueMaterialSelection,
  enqueueScenesAndPrompts,
  enqueueSubtitleGeneration,
  enqueueVideoRender,
  enqueueVisualCandidates
} from "../queues/videoQueue.js";
import { generateSceneNarration } from "./audioService.js";
import { generateSceneMaterial } from "./imageService.js";
import { logJob } from "./jobLog.js";
import { buildVisualProfile, generateScenePlans, generateStory } from "./storyService.js";
import { renderProjectVideo } from "./videoService.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

// BullMQ'dan gelen job adını ilgili üretim fonksiyonuna yönlendirir; worker bu sayede uzun if/else blokları içermez.
export async function runPipelineStep(jobName: string, projectId: string) {
  const step = pipelineSteps[jobName];
  if (!step) throw new Error(`Unknown pipeline job: ${jobName}`);
  await step(projectId);
}

// Adım 1: Kullanıcının promptunu kısa bir hikayeye ve tam 3 sahneye çevirir; sonraki tüm görsel/ses işlemleri bu sahnelere bağlıdır.
async function generateStoryStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_story", errorMessage: "" });
  await logJob(projectId, "story", "running", "Kısa hikaye ve 3 sahne hazırlanıyor.");
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

  await logJob(projectId, "story", "completed", "Hikaye ve sahne yapısı hazır.");
  await enqueueScenesAndPrompts(projectId);
}

// Adım 2: Her Türkçe sahneyi görsel modellerin daha iyi anlayacağı İngilizce ve net görsel promptlara dönüştürür.
async function generateScenePromptsStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_scenes" });
  await logJob(projectId, "prompts", "running", "Sahneler için görsel promptları hazırlanıyor.");
  const project = await ProjectModel.findById(projectId).orFail();
  const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
  const plans = await generateScenePlans(
    project.theme,
    project.style,
    scenes.map((scene) => scene.text)
  );

  for (const [index, scene] of scenes.entries()) {
    const plan = plans[index];
    scene.visualPrompt = plan.visualPrompt;
    scene.imagePrompt = plan.visualPrompt;
    scene.negativePrompt = plan.negativePrompt;
    scene.searchTerms = plan.searchTerms;
    scene.status = "prompt-ready";
    await scene.save();
  }

  await logJob(projectId, "prompts", "completed", `${scenes.length} sahne promptu hazır.`);
  await enqueueVisualCandidates(projectId);
}

// Adım 3: Her sahne için cloud görsel üretimi veya fallback görsel seçimi yapar, sonucu hem Scene hem Asset olarak MongoDB'ye yazar.
async function generateVisualsStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_visuals" });
  await logJob(projectId, "visuals", "running", "Görseller üretiliyor.");
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
    await logJob(projectId, "visuals", "completed", `Sahne ${scene.order}: ${generated.provider} görseli hazır.`);
  }

  await enqueueMaterialSelection(projectId);
}

// Adım 4: Şimdiki sürümde her sahne en iyi kullanılabilir materyalini zaten saklar; bu adım akışın okunabilir checkpoint'idir.
async function selectMaterialsStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "selecting_materials" });
  await logJob(projectId, "materials", "completed", "Görsel materyaller kaydedildi.");
  await enqueueAudioGeneration(projectId);
}

// Adım 5: Seslendirmeyi sahne sahne üretir; böylece her sahnenin süresi ölçülür ve video geçişleri sese göre ayarlanır.
async function generateAudioStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_audio" });
  await logJob(projectId, "audio", "running", "ElevenLabs ile sahne sahne ses hazırlanıyor.");
  const project = await ProjectModel.findById(projectId).orFail();
  const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
  const sceneNarrationTexts = scenes.map((scene) => scene.subtitle || scene.text);
  const generated = await generateSceneNarration(projectId, sceneNarrationTexts, "tr", project.voiceProvider, project.elevenLabsVoiceId);

  await AssetModel.deleteMany({ projectId, type: "audio" });
  await AssetModel.create({
    projectId,
    type: "audio",
    path: generated.audioPath,
    provider: generated.provider,
    metadata: {
      sceneAudioDurations: generated.sceneDurationsSeconds,
      sceneNarrationTexts: sceneNarrationTexts.map((text) => cleanNarrationLine(text))
    }
  });

  project.audioPath = generated.audioPath;
  await project.save();
  await logJob(projectId, "audio", "completed", `${generated.provider} ses dosyası hazır.`);
  await enqueueSubtitleGeneration(projectId);
}

// Adım 6: Altyazı metni, seslendirmede kullanılan sahne cümlelerinden üretilir; ses, altyazı ve hikaye aynı kalır.
async function generateSubtitlesStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "generating_subtitles" });
  const project = await ProjectModel.findById(projectId).orFail();

  if (!project.subtitlesEnabled) {
    await AssetModel.deleteMany({ projectId, type: "subtitle" });
    await logJob(projectId, "subtitles", "completed", "Altyazı kapalı.");
    await enqueueVideoRender(projectId);
    return;
  }

  const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
  const projectDir = await ensureProjectOutput(projectId);
  const filename = "subtitles-tr.json";
  await fs.writeFile(
    path.join(projectDir, filename),
    JSON.stringify({ language: "tr", story: project.story, scenes: scenes.map((scene) => scene.subtitle || scene.text) }, null, 2),
    "utf8"
  );
  await AssetModel.deleteMany({ projectId, type: "subtitle" });
  await AssetModel.create({ projectId, type: "subtitle", path: publicPathFor(projectId, filename), provider: "generated", metadata: { language: "tr" } });
  await logJob(projectId, "subtitles", "completed", "Altyazı içeriği hazır.");
  await enqueueVideoRender(projectId);
}

// Adım 7: Remotion; görselleri, altyazıları ve ölçülmüş ses sürelerini kullanarak final MP4 videoyu render eder.
async function renderVideoStep(projectId: string) {
  await ProjectModel.findByIdAndUpdate(projectId, { status: "rendering_video" });
  await logJob(projectId, "video", "running", "Remotion MP4 render başlıyor.");
  const project = await ProjectModel.findById(projectId).orFail();
  const scenes = await SceneModel.find({ projectId }).sort({ order: 1 });
  const audioAsset = await AssetModel.findOne({ projectId, type: "audio" }).sort({ createdAt: -1 });
  const sceneAudioDurations = Array.isArray(audioAsset?.metadata?.sceneAudioDurations) ? audioAsset.metadata.sceneAudioDurations as number[] : [];
  const sceneNarrationTexts = Array.isArray(audioAsset?.metadata?.sceneNarrationTexts) ? audioAsset.metadata.sceneNarrationTexts as string[] : [];
  const videoPath = await renderProjectVideo(
    projectId,
    {
      title: project.title,
      story: project.story,
      audioPath: project.audioPath,
      aspectRatio: project.aspectRatio,
      language: "tr",
      subtitlesEnabled: project.subtitlesEnabled,
      sceneDurationsInFrames: sceneAudioDurations.map((seconds) => Math.ceil((Number(seconds) + 0.42) * 30)),
      scenes: scenes.map((scene) => ({
        text: scene.text,
        subtitle: shortSubtitle(sceneNarrationTexts[scene.order - 1] || scene.subtitle || scene.text),
        imagePath: scene.imagePath,
        materialType: scene.materialType
      }))
    },
    "final-tr.mp4"
  );

  await AssetModel.deleteMany({ projectId, type: "video" });
  await AssetModel.create({ projectId, type: "video", path: videoPath, provider: "remotion", metadata: { language: "tr" } });
  await ProjectModel.findByIdAndUpdate(projectId, { status: "completed", errorMessage: "", videoPath });
  await logJob(projectId, "video", "completed", "MP4 video hazır.");
}

// Altyazıyı dikey videoda taşmayacak kadar kısaltır; anlatılan cümlenin ana anlamını bozmadan ilk cümleyi korur.
function shortSubtitle(value: string) {
  const cleaned = value.replace(/\s+/g, " ").trim();
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const withoutSceneLabel = firstSentence.replace(/^sahne\s*\d+\s*[:.-]?\s*/i, "");
  if (withoutSceneLabel.length <= 82) return withoutSceneLabel;
  const cut = withoutSceneLabel.slice(0, 82);
  const breakPoint = Math.max(cut.lastIndexOf(" "), 48);
  return `${cut.slice(0, breakPoint).trim()}...`;
}

// Model bazen "Sahne 1:" gibi etiketler üretir; bu yardımcı fonksiyon o etiketleri ses/metin kanıtından temizler.
function cleanNarrationLine(value: string) {
  return value
    .replace(/^\s*(sahne|scene)\s*\d+\s*[:.-]?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/g, "");
}

const pipelineSteps: Record<string, (projectId: string) => Promise<void>> = {
  "generate-story": generateStoryStep,
  "generate-scenes-and-prompts": generateScenePromptsStep,
  "generate-visual-candidates": generateVisualsStep,
  "select-best-materials": selectMaterialsStep,
  "generate-audio": generateAudioStep,
  "generate-subtitles": generateSubtitlesStep,
  "render-video": renderVideoStep
};
