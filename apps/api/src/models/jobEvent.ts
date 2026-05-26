import { Schema, model, Types } from "mongoose";

const jobEventSchema = new Schema(
  {
    projectId: { type: Types.ObjectId, ref: "Project", required: true, index: true },
    step: { type: String, required: true },
    status: { type: String, required: true },
    message: { type: String, required: true }
  },
  { timestamps: true }
);

export const JobEventModel = model("JobEvent", jobEventSchema);
