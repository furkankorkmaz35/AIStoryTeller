import { Router } from "express";
import { z } from "zod";
import { ContentAccountModel } from "../models/contentAccount.js";
import { ContentIdeaModel } from "../models/contentIdea.js";
import { ProjectModel } from "../models/project.js";
import { enqueueStoryGeneration } from "../queues/videoQueue.js";
import { generateAutopilotIdeas, nextPostingDate } from "../services/autopilotService.js";
import { logJob } from "../services/jobLog.js";
import { resolveSceneCountForContent, type LanguageCode } from "../services/storyService.js";

const router = Router();

const accountSchema = z.object({
  name: z.string().trim().min(2),
  platform: z.enum(["instagram", "tiktok", "youtube"]).default("instagram"),
  platforms: z.array(z.enum(["instagram", "tiktok", "youtube"])).min(1).max(3).default(["instagram", "tiktok", "youtube"]),
  category: z.string().trim().min(2).default("Türkiye merak atlası"),
  concept: z.string().trim().min(4),
  audience: z.string().trim().min(2).default("Türkiye gündemini, tarihi ve sporu sıkıcı olmayan kısa videolarla takip etmek isteyen izleyici"),
  tone: z.string().trim().min(2).default("merak uyandıran, hızlı, güvenilir, şehirli ve gösterişsiz"),
  language: z.enum(["tr", "en", "de", "es"]).default("tr"),
  forbiddenTopics: z.array(z.string()).default([]),
  dailyPostTarget: z.coerce.number().int().min(1).max(6).default(1),
  postingDays: z.array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"])).min(1).max(7).default(["mon", "wed", "fri"]),
  postingHours: z.array(z.string()).min(1).max(6).default(["20:30"]),
  autopilotMode: z.enum(["manual", "assistant", "autopilot-safe", "autopilot"]).default("autopilot-safe"),
  status: z.enum(["active", "paused"]).default("active")
});

router.post("/accounts", async (request, response, next) => {
  try {
    const body = accountSchema.parse(request.body);
    const account = await ContentAccountModel.create(body);
    response.status(201).json(account);
  } catch (error) {
    next(error);
  }
});

router.get("/accounts", async (_request, response, next) => {
  try {
    const accounts = await ContentAccountModel.find().sort({ createdAt: -1 }).limit(20);
    response.json(accounts);
  } catch (error) {
    next(error);
  }
});

router.get("/ideas", async (request, response, next) => {
  try {
    const filter = request.query.accountId ? { accountId: request.query.accountId } : {};
    const ideas = await ContentIdeaModel.find(filter).sort({ createdAt: -1 }).limit(40);
    response.json(ideas);
  } catch (error) {
    next(error);
  }
});

router.post("/accounts/:id/generate-ideas", async (request, response, next) => {
  try {
    const account = await ContentAccountModel.findById(request.params.id).orFail();
    const count = Math.min(8, Math.max(1, Number(request.body?.count ?? account.dailyPostTarget ?? 3)));
    const generated = await generateAutopilotIdeas(
      {
        name: account.name,
        platform: account.platform,
        platforms: account.platforms,
        category: account.category,
        concept: account.concept,
        audience: account.audience,
        tone: account.tone,
        language: account.language as LanguageCode,
        forbiddenTopics: account.forbiddenTopics,
        postingDays: account.postingDays,
        postingHours: account.postingHours
      },
      count
    );
    const ideas = await ContentIdeaModel.insertMany(
      generated.map((idea, index) => ({
        accountId: account._id,
        source: idea.source,
        trend: idea.trend,
        title: idea.title,
        hook: idea.hook,
        theme: idea.theme,
        angle: idea.angle,
        score: idea.score,
        scoreReason: idea.scoreReason,
        captionSeed: idea.captionSeed,
        hashtags: idea.hashtags,
        scheduledFor: nextPostingDate(account.postingHours, index, account.postingDays)
      }))
    );
    response.status(201).json(ideas);
  } catch (error) {
    next(error);
  }
});

router.post("/accounts/:id/auto-produce", async (request, response, next) => {
  try {
    const account = await ContentAccountModel.findById(request.params.id).orFail();
    const count = Math.min(8, Math.max(3, Number(request.body?.count ?? 5)));
    const generated = await generateAutopilotIdeas(
      {
        name: account.name,
        platform: account.platform,
        platforms: account.platforms,
        category: account.category,
        concept: account.concept,
        audience: account.audience,
        tone: account.tone,
        language: account.language as LanguageCode,
        forbiddenTopics: account.forbiddenTopics,
        postingDays: account.postingDays,
        postingHours: account.postingHours
      },
      count
    );
    const ideas = await ContentIdeaModel.insertMany(
      generated.map((idea, index) => ({
        accountId: account._id,
        source: idea.source,
        trend: idea.trend,
        title: idea.title,
        hook: idea.hook,
        theme: idea.theme,
        angle: idea.angle,
        score: idea.score,
        scoreReason: idea.scoreReason,
        captionSeed: idea.captionSeed,
        hashtags: idea.hashtags,
        scheduledFor: nextPostingDate(account.postingHours, index, account.postingDays)
      }))
    );
    const selected = ideas.sort((left, right) => right.score - left.score)[0];
    const result = await produceIdea(selected);
    response.status(201).json({ ideas, selectedIdea: result.idea, project: result.project });
  } catch (error) {
    next(error);
  }
});

router.post("/ideas/:id/approve", async (request, response, next) => {
  try {
    const idea = await ContentIdeaModel.findByIdAndUpdate(request.params.id, { status: "approved" }, { new: true }).orFail();
    response.json(idea);
  } catch (error) {
    next(error);
  }
});

router.post("/ideas/:id/reject", async (request, response, next) => {
  try {
    const idea = await ContentIdeaModel.findByIdAndUpdate(request.params.id, { status: "rejected" }, { new: true }).orFail();
    response.json(idea);
  } catch (error) {
    next(error);
  }
});

router.post("/ideas/:id/produce", async (request, response, next) => {
  try {
    const idea = await ContentIdeaModel.findById(request.params.id).orFail();
    const { project } = await produceIdea(idea);
    response.status(201).json({ idea, project });
  } catch (error) {
    next(error);
  }
});

router.post("/run-due", async (_request, response, next) => {
  try {
    const now = new Date();
    const ideas = await ContentIdeaModel.find({
      status: { $in: ["approved", "scheduled"] },
      scheduledFor: { $lte: now },
      projectId: null
    })
      .sort({ scheduledFor: 1 })
      .limit(5);
    const produced = [];
    for (const idea of ideas) {
      const result = await produceIdea(idea);
      produced.push({ ideaId: idea.id, projectId: result.project.id });
    }
    response.json({ checkedAt: now.toISOString(), produced });
  } catch (error) {
    next(error);
  }
});

async function produceIdea(idea: any) {
  if (!idea) throw new Error("Idea not found");
  if (idea.projectId) {
    const project = await ProjectModel.findById(idea.projectId).orFail();
    return { idea, project };
  }
  const account = await ContentAccountModel.findById(idea.accountId).orFail();
  const targetPlatform = account.platform === "youtube" ? "shorts" : account.platform === "instagram" ? "reels" : "tiktok";
  const theme = [
    `Kategori: ${account.category || "Türkiye merak atlası"}`,
    `Kanal konsepti: ${account.concept}`,
    `Editör formatı: güçlü hook, kısa bağlam, iki net detay, kırılma anı ve CTA.`,
    `Hook: ${idea.hook}`,
    `Tema: ${idea.theme}`,
    `Açı: ${idea.angle}`,
    `Caption/thumbnail tohumu: ${idea.captionSeed}`
  ].join("\n");
  const project = await ProjectModel.create({
    theme,
    title: `${idea.title} | ${account.category || "Türkiye merak atlası"}`,
    style: "cinematic",
    ageGroup: "genel sosyal medya izleyicisi",
    sceneCount: resolveSceneCountForContent(theme),
    aspectRatio: "9:16",
    targetPlatform,
    languages: [account.language],
    imageProvider: "auto",
    voiceProvider: "elevenlabs",
    elevenLabsVoiceId: "",
    subtitlesEnabled: true,
    materialMode: "hybrid-cloud",
    imageQuality: "balanced",
    status: "queued"
  });
  idea.status = "producing";
  idea.projectId = project.id;
  await idea.save();
  await logJob(project.id, "autopilot", "queued", `Otopilot fikrinden proje oluşturuldu: ${idea.title}`);
  await enqueueStoryGeneration(project.id);
  return { idea, project };
}

export { router as autopilotRouter };
