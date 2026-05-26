import { Schema, model, Types } from "mongoose";

const assetSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    sceneId: { type: Types.ObjectId, ref: "Scene", default: null },
    type: { type: String, enum: ["image", "audio", "video"], required: true },
    path: { type: String, required: true },
    provider: { type: String, default: "fallback" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

export const AssetModel = model("Asset", assetSchema);
