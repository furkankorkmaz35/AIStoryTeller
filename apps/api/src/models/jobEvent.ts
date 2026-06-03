import { Schema, model, Types } from "mongoose";

// Pipeline boyunca oluşan her okunabilir olay burada saklanır; frontend bu kayıtlarla hocaya üretim akışını kanıtlar.
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
