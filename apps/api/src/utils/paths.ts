import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";

const currentFile = fileURLToPath(import.meta.url);
export const apiRoot = path.resolve(path.dirname(currentFile), "../..");
export const publicRoot = path.join(apiRoot, "public");
export const outputsRoot = path.resolve(process.env.OUTPUTS_DIR ?? path.join(process.cwd(), "outputs"));

// Her proje kendi output klasörünü alır; MongoDB'deki dosya yolları fiziksel dosyalarla kolay eşleşir.
export async function ensureProjectOutput(projectId: string) {
  const projectDir = path.join(outputsRoot, projectId);
  await fs.mkdir(projectDir, { recursive: true });
  return projectDir;
}

// MongoDB'ye bu public path yazılır; Express de aynı dosyayı /outputs statik rotasından servis eder.
export function publicPathFor(projectId: string, filename: string) {
  return `/outputs/${projectId}/${filename}`;
}
