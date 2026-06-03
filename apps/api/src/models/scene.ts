import { Schema, model, Types } from "mongoose";

// A project is rendered from ordered scenes; each scene owns its text, prompt and selected visual.
const sceneSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    order: { type: Number, required: true },
    text: { type: String, required: true },
    imagePrompt: { type: String, default: "" },
    visualPrompt: { type: String, default: "" },
    negativePrompt: { type: String, default: "" },
    searchTerms: { type: [String], default: [] },
    imagePath: { type: String, default: "" },
    videoPath: { type: String, default: "" },
    materialPath: { type: String, default: "" },
    materialType: { type: String, enum: ["ai-image", "stock-image", "fallback-scene", "external-video", ""], default: "" },
    materialProvider: { type: String, default: "" },
    materialQualityScore: { type: Number, min: 0, max: 100, default: 0 },
    materialQualityReason: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    status: { type: String, default: "pending" }
  },
  { timestamps: true }
);

export const SceneModel = model("Scene", sceneSchema);
