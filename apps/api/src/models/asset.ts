import { Schema, model, Types } from "mongoose";

// Stores generated media evidence: image, audio, subtitle and final MP4 paths per project.
const assetSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    sceneId: { type: Types.ObjectId, ref: "Scene", default: null },
    type: { type: String, enum: ["image", "stock-image", "audio", "video", "subtitle"], required: true },
    path: { type: String, required: true },
    provider: { type: String, default: "fallback" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const AssetModel = model("Asset", assetSchema);
