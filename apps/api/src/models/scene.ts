import { Schema, model, Types } from "mongoose";

const sceneSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    order: { type: Number, required: true },
    text: { type: String, required: true },
    imagePrompt: { type: String, default: "" },
    imagePath: { type: String, default: "" },
    subtitle: { type: String, default: "" },
    status: { type: String, default: "pending" }
  },
  { timestamps: true }
);

export const SceneModel = model("Scene", sceneSchema);
