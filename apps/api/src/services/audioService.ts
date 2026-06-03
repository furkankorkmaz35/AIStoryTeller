import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { ElevenLabsClient } from "elevenlabs";
import { env } from "../config/env.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

// Generates one Turkish narration file, but asks ElevenLabs scene by scene for better sync.
export async function generateSceneNarration(projectId: string, sceneTexts: string[], _language = "tr", requestedProvider = env.ttsProvider, voiceId = "") {
  const projectDir = await ensureProjectOutput(projectId);
  const cleanedScenes = sceneTexts.map(prepareSceneNarrationText).filter(Boolean);
  const safeScenes = cleanedScenes.length ? cleanedScenes : ["Video anlatımı hazırlanıyor."];

  if (requestedProvider === "elevenlabs") {
    const elevenLabsAudio = await tryElevenLabsSceneNarration(projectDir, safeScenes, voiceId);
    if (elevenLabsAudio) {
      return {
        audioPath: publicPathFor(projectId, elevenLabsAudio.filename),
        provider: "elevenlabs",
        sceneDurationsSeconds: elevenLabsAudio.sceneDurationsSeconds
      };
    }
  }

  const silentFilename = "narration-tr.wav";
  await fs.writeFile(path.join(projectDir, silentFilename), createSilentWav(estimateTotalDuration(safeScenes)));
  return {
    audioPath: publicPathFor(projectId, silentFilename),
    provider: "fallback-silent-wav",
    sceneDurationsSeconds: estimateSceneDurationsFromText(safeScenes)
  };
}

// Tries configured Turkish voices in order; if one voice truncates text, the next voice is tested.
async function tryElevenLabsSceneNarration(projectDir: string, scenes: string[], voiceId = "") {
  if (!env.elevenLabsApiKey) {
    console.warn("ELEVENLABS_API_KEY is missing, using audio fallback.");
    return null;
  }

  const filename = "narration-tr-elevenlabs.mp3";
  const outputPath = path.join(projectDir, filename);
  const client = new ElevenLabsClient({ apiKey: env.elevenLabsApiKey });
  const voiceIds = uniqueVoiceIds([voiceId, env.elevenLabsVoiceId, env.elevenLabsFallbackVoiceId, "JBFqnCBsd6RMkjVDRZzb"]);
  let lastError: unknown = null;

  for (const candidateVoiceId of voiceIds) {
    const partPaths: string[] = [];
    try {
      const sceneDurationsSeconds: number[] = [];
      for (const [index, scene] of scenes.entries()) {
        const partPath = path.join(projectDir, `narration-tr-scene-${index + 1}.mp3`);
        await writeElevenLabsChunk(client, candidateVoiceId, scene, partPath);
        const stats = await fs.stat(partPath);
        const duration = await getAudioDurationSeconds(partPath);
        if (stats.size < 1000 || duration < estimateMinimumAudioSeconds(scene)) {
          throw new Error(`ElevenLabs scene ${index + 1} too short: ${duration.toFixed(2)}s for "${scene}".`);
        }
        partPaths.push(partPath);
        sceneDurationsSeconds.push(duration);
      }
      await concatMp3Files(projectDir, partPaths, outputPath);
      await Promise.all(partPaths.map((partPath) => fs.rm(partPath, { force: true })));
      const finalDuration = await getAudioDurationSeconds(outputPath);
      if (finalDuration >= Math.max(2.4, sceneDurationsSeconds.reduce((total, value) => total + value, 0) - 0.35)) {
        return { filename, sceneDurationsSeconds };
      }
      throw new Error(`ElevenLabs concatenated audio too short: ${finalDuration.toFixed(2)}s.`);
    } catch (error) {
      lastError = error;
      await Promise.all(partPaths.map((partPath) => fs.rm(partPath, { force: true })));
      await fs.rm(outputPath, { force: true });
      console.warn(`ElevenLabs voice ${candidateVoiceId} failed, trying next voice fallback.`, error);
    }
  }

  console.warn("ElevenLabs scene TTS failed, using silent fallback.", lastError);
  return null;
}

function uniqueVoiceIds(voiceIds: string[]) {
  return [...new Set(voiceIds.map((id) => id.trim()).filter(Boolean))];
}

// Single scene requests reduce ElevenLabs free-tier truncation and give measurable scene durations.
async function writeElevenLabsChunk(client: ElevenLabsClient, voiceId: string, text: string, outputPath: string) {
  const audioStream = await client.textToSpeech.convert(
    voiceId,
    {
      text,
      model_id: env.elevenLabsModel,
      output_format: "mp3_44100_128",
      voice_settings: {
        stability: 0.58,
        similarity_boost: 0.78,
        style: 0.18,
        use_speaker_boost: true
      }
    },
    { timeoutInSeconds: 120 }
  );

  await pipeline(audioStream, createWriteStream(outputPath));
}

// Joins per-scene MP3 files without re-encoding so narration stays as natural as ElevenLabs returned it.
async function concatMp3Files(projectDir: string, partPaths: string[], outputPath: string) {
  const listPath = path.join(projectDir, `concat-${Date.now()}.txt`);
  const listContent = partPaths.map((partPath) => `file '${escapeConcatPath(partPath)}'`).join("\n");
  await fs.writeFile(listPath, listContent, "utf8");
  try {
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath], { timeout: 120000 });
  } finally {
    await fs.rm(listPath, { force: true });
  }
}

// Keeps narration short enough for 15-20 second classroom demos.
function prepareSceneNarrationText(text: string) {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/^\s*(sahne|scene)\s*\d+\s*[:.-]\s*/gim, " ")
    .replace(/\s+/g, " ")
    .trim();
  return ensureSentenceEnding(limitSceneNarration(clean || "Video sahnesi başlıyor."));
}

function limitSceneNarration(text: string) {
  const maxWords = 13;
  const maxCharacters = 92;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords && text.length <= maxCharacters) return text;
  return words.slice(0, maxWords).join(" ").slice(0, maxCharacters).trim();
}

// Used only when real audio is unavailable; keeps the render pipeline from failing during demos.
function estimateSceneDurationsFromText(scenes: string[]) {
  return scenes.map((scene) => clamp(scene.split(/\s+/).filter(Boolean).length * 0.38 + 0.55, 2.4, 6.8));
}

function estimateTotalDuration(scenes: string[]) {
  return Math.ceil(estimateSceneDurationsFromText(scenes).reduce((total, value) => total + value, 0));
}

async function getAudioDurationSeconds(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath
    ]);
    const duration = Number(String(stdout).trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch {
    return 0;
  }
}

// Rejects obviously truncated ElevenLabs chunks before they reach the final render.
function estimateMinimumAudioSeconds(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2.2, words * 0.18);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ensureSentenceEnding(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return clean;
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function escapeConcatPath(value: string) {
  return value.replaceAll("'", "'\\''");
}

// Minimal WAV generator for no-key/offline fallback; not used when ElevenLabs succeeds.
function createSilentWav(durationInSeconds: number): Buffer {
  const sampleRate = 44100;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = durationInSeconds * sampleRate * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}
