import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { env } from "../config/env.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

export async function generateNarration(projectId: string, story: string) {
  const projectDir = await ensureProjectOutput(projectId);

  if (env.ttsProvider === "system") {
    const systemAudio = await trySystemNarration(projectDir, story);
    if (systemAudio) {
      return { audioPath: publicPathFor(projectId, systemAudio), provider: "macos-say" };
    }
  }

  const filename = "narration.wav";
  await fs.writeFile(path.join(projectDir, filename), createSilentWav(estimateDuration(story)));
  return { audioPath: publicPathFor(projectId, filename), provider: "fallback-silent-wav" };
}

async function trySystemNarration(projectDir: string, story: string) {
  const tempFilename = "narration-source.aiff";
  const filename = "narration.wav";
  const tempPath = path.join(projectDir, tempFilename);
  const outputPath = path.join(projectDir, filename);
  try {
    await execFileAsync("/usr/bin/say", ["-o", tempPath, story.slice(0, 2800)], { timeout: 45000 });
    await execFileAsync("/usr/bin/afconvert", ["-f", "WAVE", "-d", "LEI16@44100", tempPath, outputPath], { timeout: 45000 });
    await fs.rm(tempPath, { force: true });
    const stats = await fs.stat(outputPath);
    return stats.size > 1000 ? filename : null;
  } catch (error) {
    console.warn("System TTS failed, using silent fallback.", error);
    return null;
  }
}

function estimateDuration(story: string) {
  const wordCount = story.split(/\s+/).filter(Boolean).length;
  return Math.max(8, Math.min(45, Math.ceil(wordCount / 2.2)));
}

function createSilentWav(durationSeconds: number) {
  const sampleRate = 44100;
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = sampleRate * durationSeconds;
  const dataSize = sampleCount * channels * (bitsPerSample / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(channels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}
