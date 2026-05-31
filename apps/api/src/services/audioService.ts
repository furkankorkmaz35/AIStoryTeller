import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { ElevenLabsClient } from "elevenlabs";
import { EdgeTTS } from "node-edge-tts";
import { env } from "../config/env.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

const execFileAsync = promisify(execFile);

export async function generateNarration(projectId: string, story: string) {
  const projectDir = await ensureProjectOutput(projectId);

  if (env.ttsProvider === "edge" || env.ttsProvider === "auto") {
    const edgeAudio = await tryEdgeNarration(projectDir, story);
    if (edgeAudio) {
      return { audioPath: publicPathFor(projectId, edgeAudio), provider: "edge-tts" };
    }
  }

  if (env.ttsProvider === "elevenlabs" || env.ttsProvider === "auto") {
    const elevenLabsAudio = await tryElevenLabsNarration(projectDir, story);
    if (elevenLabsAudio) {
      return { audioPath: publicPathFor(projectId, elevenLabsAudio), provider: "elevenlabs" };
    }
  }

  if (env.ttsProvider === "system" || env.ttsProvider === "auto") {
    const systemAudio = await trySystemNarration(projectDir, story);
    if (systemAudio) {
      return { audioPath: publicPathFor(projectId, systemAudio), provider: "system-tts" };
    }
  }

  const silentFilename = "narration.wav";
  await fs.writeFile(path.join(projectDir, silentFilename), createSilentWav(estimateDuration(story)));
  return { audioPath: publicPathFor(projectId, silentFilename), provider: "fallback-silent-wav" };
}

async function tryEdgeNarration(projectDir: string, story: string) {
  try {
    const filename = "narration.mp3";
    const outputPath = path.join(projectDir, filename);
    const tts = new EdgeTTS({
      voice: env.edgeTtsVoice,
      lang: env.edgeTtsLang,
      outputFormat: env.edgeTtsOutputFormat,
      rate: env.edgeTtsRate,
      pitch: env.edgeTtsPitch,
      volume: env.edgeTtsVolume,
      timeout: 60000
    });

    await tts.ttsPromise(story.slice(0, env.edgeTtsMaxCharacters), outputPath);
    const stats = await fs.stat(outputPath);
    return stats.size > 1000 ? filename : null;
  } catch (error) {
    console.warn("Edge TTS failed, using next audio fallback.", error);
    return null;
  }
}

async function tryElevenLabsNarration(projectDir: string, story: string) {
  if (!env.elevenLabsApiKey) {
    console.warn("ELEVENLABS_API_KEY is missing, using audio fallback.");
    return null;
  }

  try {
    const filename = "narration.mp3";
    const outputPath = path.join(projectDir, filename);
    const client = new ElevenLabsClient({ apiKey: env.elevenLabsApiKey });
    const audioStream = await client.textToSpeech.convert(
      env.elevenLabsVoiceId,
      {
        text: story.slice(0, env.elevenLabsMaxCharacters),
        model_id: env.elevenLabsModel,
        output_format: "mp3_44100_128"
      },
      { timeoutInSeconds: 120 }
    );

    await pipeline(audioStream, createWriteStream(outputPath));
    const stats = await fs.stat(outputPath);
    return stats.size > 1000 ? filename : null;
  } catch (error) {
    console.warn("ElevenLabs TTS failed, using audio fallback.", error);
    return null;
  }
}

async function trySystemNarration(projectDir: string, story: string) {
  const tempFilename = "narration-source.aiff";
  const filename = "narration.wav";
  const tempPath = path.join(projectDir, tempFilename);
  const outputPath = path.join(projectDir, filename);

  try {
    await execFileAsync("/usr/bin/say", ["-o", tempPath, story.slice(0, 2800)], { timeout: 45000 });
    await execFileAsync("/usr/bin/afconvert", ["-f", "WAVE", "-d", "LEI16@44100", tempPath, outputPath]);
    await fs.rm(tempPath, { force: true });
    const stats = await fs.stat(outputPath);
    return stats.size > 1000 ? filename : null;
  } catch (error) {
    console.warn("System TTS failed, using silent fallback.", error);
    return null;
  }
}

function estimateDuration(text: string): number {
  return Math.max(4, Math.ceil(text.length / 15));
}

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
