import { z } from "zod";

// Gelen request kuralları controller dışında tutulur; API sözleşmesi tek dosyada görünür ve kolay test edilir.
export const createProjectSchema = z.object({
  theme: z.string().trim().min(2),
  style: z.enum(["storybook", "cartoon", "cinematic", "educational"]).default("cinematic"),
  ageGroup: z.string().trim().min(2).default("7-10"),
  sceneCount: z.coerce.number().int().min(0).max(6).default(0),
  sceneCountMode: z.enum(["auto", "manual"]).default("auto"),
  aspectRatio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  imageProvider: z.enum(["designed", "auto", "cloudflare", "pollinations", "huggingface", "stock"]).default("pollinations"),
  voiceProvider: z.enum(["elevenlabs"]).default("elevenlabs"),
  elevenLabsVoiceId: z.string().trim().optional().default(""),
  subtitlesEnabled: z.boolean().default(true),
  materialMode: z.enum(["hybrid-cloud", "ai-image", "stock-assisted"]).default("ai-image")
});
