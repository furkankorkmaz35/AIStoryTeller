import { Schema, model } from "mongoose";

// One MongoDB project equals one prompt-to-video production run.
export const projectStatuses = [
  "queued",
  "generating_story",
  "generating_scenes",
  "generating_visuals",
  "selecting_materials",
  "generating_audio",
  "generating_subtitles",
  "rendering_video",
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
    imageProvider: { type: String, default: "pollinations" },
    voiceProvider: { type: String, default: "elevenlabs" },
    elevenLabsVoiceId: { type: String, default: "" },
    subtitlesEnabled: { type: Boolean, default: true },
    materialMode: { type: String, enum: ["hybrid-cloud", "ai-image", "stock-assisted"], default: "ai-image" },
    status: { type: String, enum: projectStatuses, default: "queued" },
    errorMessage: { type: String, default: "" },
    thumbnailPath: { type: String, default: "" },
    audioPath: { type: String, default: "" },
    videoPath: { type: String, default: "" }
  },
  { timestamps: true }
);

export const ProjectModel = model("Project", projectSchema);
