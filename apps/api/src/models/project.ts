import { Schema, model } from "mongoose";

export const projectStatuses = [
  "queued",
  "generating_story",
  "generating_scenes",
  "translating_variants",
  "awaiting_import",
  "generating_visuals",
  "selecting_materials",
  "generating_audio",
  "generating_subtitles",
  "selecting_bgm",
  "rendering_video",
  "preparing_export",
  "completed",
  "failed"
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

const projectSchema = new Schema(
  {
    theme: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    story: { type: String, default: "" },
    style: { type: String, required: true, trim: true },
    visualProfile: { type: String, default: "" },
    ageGroup: { type: String, required: true, trim: true },
    sceneCount: { type: Number, required: true, min: 3, default: 3 },
    aspectRatio: { type: String, enum: ["9:16", "16:9", "1:1"], default: "9:16" },
    targetPlatform: { type: String, enum: ["tiktok", "reels", "shorts"], default: "tiktok" },
    creationMode: { type: String, enum: ["full-auto", "studio-import"], default: "full-auto" },
    languages: { type: [String], default: ["tr"] },
    imageProvider: { type: String, default: "pollinations" },
    voiceProvider: { type: String, default: "elevenlabs" },
    elevenLabsVoiceId: { type: String, default: "" },
    subtitlesEnabled: { type: Boolean, default: true },
    materialMode: { type: String, enum: ["hybrid-cloud", "ai-image", "stock-assisted"], default: "ai-image" },
    imageQuality: { type: String, enum: ["demo", "balanced", "high"], default: "balanced" },
    status: { type: String, enum: projectStatuses, default: "queued" },
    errorMessage: { type: String, default: "" },
    thumbnailPath: { type: String, default: "" },
    videoPath: { type: String, default: "" }
  },
  { timestamps: true }
);

export const ProjectModel = model("Project", projectSchema);
