import { Schema, model, Types } from "mongoose";

const contentIdeaSchema = new Schema(
  {
    accountId: { type: Types.ObjectId, ref: "ContentAccount", required: true, index: true },
    source: { type: String, default: "strategy" },
    trend: { type: String, default: "" },
    title: { type: String, required: true },
    hook: { type: String, default: "" },
    theme: { type: String, required: true },
    angle: { type: String, default: "" },
    score: { type: Number, min: 0, max: 100, default: 70 },
    scoreReason: { type: String, default: "" },
    status: { type: String, enum: ["draft", "approved", "scheduled", "producing", "produced", "rejected"], default: "draft" },
    scheduledFor: { type: Date, default: null },
    projectId: { type: Types.ObjectId, ref: "Project", default: null },
    captionSeed: { type: String, default: "" },
    hashtags: { type: [String], default: [] }
  },
  { timestamps: true }
);

export const ContentIdeaModel = model("ContentIdea", contentIdeaSchema);
