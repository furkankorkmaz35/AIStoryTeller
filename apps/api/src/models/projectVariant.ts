import { Schema, model, Types } from "mongoose";

export const variantStatuses = ["queued", "translating", "audio", "subtitles", "rendering", "exporting", "completed", "failed"] as const;

const projectVariantSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    language: { type: String, required: true, index: true },
    title: { type: String, default: "" },
    story: { type: String, default: "" },
    status: { type: String, enum: variantStatuses, default: "queued" },
    audioPath: { type: String, default: "" },
    videoPath: { type: String, default: "" },
    exportCaption: { type: String, default: "" },
    exportHashtags: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    errorMessage: { type: String, default: "" }
  },
  { timestamps: true }
);

projectVariantSchema.index({ projectId: 1, language: 1 }, { unique: true });

export const ProjectVariantModel = model("ProjectVariant", projectVariantSchema);
