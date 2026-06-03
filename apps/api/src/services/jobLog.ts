import { JobEventModel } from "../models/jobEvent.js";

// Seçili proje detay ekranında gösterilecek okunabilir bir pipeline olayı kaydeder.
export async function logJob(projectId: string, step: string, status: string, message: string) {
  await JobEventModel.create({ projectId, step, status, message });
}
