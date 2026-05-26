import { Schema, model } from "mongoose";

export const projectStatuses = [
  "queued",
  "generating_story",
  "generating_images",
  "generating_audio",
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
    ageGroup: { type: String, required: true, trim: true },
    sceneCount: { type: Number, required: true, min: 3, default: 3 },
    status: { type: String, enum: projectStatuses, default: "queued" },
    errorMessage: { type: String, default: "" },
    videoPath: { type: String, default: "" }
  },
  { timestamps: true }
);

export const ProjectModel = model("Project", projectSchema);
