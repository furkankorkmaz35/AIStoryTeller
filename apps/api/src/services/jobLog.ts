import { JobEventModel } from "../models/jobEvent.js";

export async function logJob(projectId: string, step: string, status: string, message: string) {
  await JobEventModel.create({ projectId, step, status, message });
}
