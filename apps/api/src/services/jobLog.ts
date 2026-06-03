import { JobEventModel } from "../models/jobEvent.js";

// Adds one readable timeline event for the selected project detail screen.
export async function logJob(projectId: string, step: string, status: string, message: string) {
  await JobEventModel.create({ projectId, step, status, message });
}
