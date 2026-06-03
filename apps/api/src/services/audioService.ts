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
import type { LanguageCode } from "./storyService.js";

const execFileAsync = promisify(execFile);

const voicesByLanguage: Record<LanguageCode, { edge: string; azure: string; lang: string }> = {
  tr: { edge: "tr-TR-EmelNeural", azure: "tr-TR-EmelNeural", lang: "tr-TR" },
  en: { edge: "en-US-JennyNeural", azure: "en-US-JennyNeural", lang: "en-US" },
  de: { edge: "de-DE-KatjaNeural", azure: "de-DE-KatjaNeural", lang: "de-DE" },
  es: { edge: "es-ES-ElviraNeural", azure: "es-ES-ElviraNeural", lang: "es-ES" }
};

export async function generateNarration(projectId: string, story: string, language: LanguageCode = "tr", requestedProvider = env.ttsProvider, voiceId = "") {
  const projectDir = await ensureProjectOutput(projectId);
  const providers = resolveVoiceProviderOrder(requestedProvider);
  const narrationText = prepareNarrationText(story);

  for (const provider of providers) {
    if (provider === "azure") {
      const azureAudio = await tryAzureNarration(projectDir, narrationText, language);
      if (azureAudio) return { audioPath: publicPathFor(projectId, azureAudio), provider: "azure-speech" };
    }
    if (provider === "edge") {
      const edgeAudio = await tryEdgeNarration(projectDir, narrationText, language);
      if (edgeAudio) return { audioPath: publicPathFor(projectId, edgeAudio), provider: "edge-tts" };
    }
    if (provider === "elevenlabs") {
      const elevenLabsAudio = await tryElevenLabsNarration(projectDir, narrationText, language, voiceId);
      if (elevenLabsAudio) return { audioPath: publicPathFor(projectId, elevenLabsAudio), provider: "elevenlabs" };
    }
  }

  const silentFilename = `narration-${language}.wav`;
  await fs.writeFile(path.join(projectDir, silentFilename), createSilentWav(estimateDuration(narrationText)));
  return { audioPath: publicPathFor(projectId, silentFilename), provider: "fallback-silent-wav" };
}

export async function generateSceneNarration(projectId: string, sceneTexts: string[], language: LanguageCode = "tr", requestedProvider = env.ttsProvider, voiceId = "") {
  const projectDir = await ensureProjectOutput(projectId);
  const cleanedScenes = sceneTexts.map(prepareSceneNarrationText).filter(Boolean);
  const safeScenes = cleanedScenes.length ? cleanedScenes : ["Video anlatımı hazırlanıyor."];
  const providers = resolveVoiceProviderOrder(requestedProvider);

  for (const provider of providers) {
    if (provider === "elevenlabs") {
      const elevenLabsAudio = await tryElevenLabsSceneNarration(projectDir, safeScenes, language, voiceId);
      if (elevenLabsAudio) return { audioPath: publicPathFor(projectId, elevenLabsAudio.filename), provider: "elevenlabs", sceneDurationsSeconds: elevenLabsAudio.sceneDurationsSeconds };
    }
  }

  const joined = safeScenes.join(" ");
  const fallback = await generateNarration(projectId, joined, language, requestedProvider, voiceId);
  return {
    ...fallback,
    sceneDurationsSeconds: estimateSceneDurationsFromText(safeScenes)
  };
}

function resolveVoiceProviderOrder(requestedProvider: string) {
  if (requestedProvider === "azure") return ["azure", "elevenlabs"];
  if (requestedProvider === "edge") return ["edge", "azure", "elevenlabs"];
  if (requestedProvider === "elevenlabs") return ["elevenlabs"];
  return ["azure", "elevenlabs"];
}

async function tryAzureNarration(projectDir: string, story: string, language: LanguageCode) {
  if (!env.azureSpeechKey || !env.azureSpeechRegion) return null;
  const voice = voicesByLanguage[language] ?? voicesByLanguage.tr;
  try {
    const filename = `narration-${language}-azure.mp3`;
    const outputPath = path.join(projectDir, filename);
    const ssml = [
      `<speak version="1.0" xml:lang="${voice.lang}" xmlns="http://www.w3.org/2001/10/synthesis">`,
      `<voice name="${voice.azure}">`,
      escapeXml(story.slice(0, env.edgeTtsMaxCharacters)),
      "</voice>",
      "</speak>"
    ].join("");
    const response = await fetch(`https://${env.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": env.azureSpeechKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
      },
      body: ssml
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.byteLength < 1000) throw new Error(`Azure Speech ${response.status}: ${bytes.toString("utf8").slice(0, 160)}`);
    await fs.writeFile(outputPath, bytes);
    return filename;
  } catch (error) {
    console.warn("Azure Speech failed, using next audio provider.", error);
    return null;
  }
}

async function tryEdgeNarration(projectDir: string, story: string, language: LanguageCode) {
  try {
    const filename = `narration-${language}-edge.mp3`;
    const outputPath = path.join(projectDir, filename);
    const voice = voicesByLanguage[language] ?? voicesByLanguage.tr;
    const tts = new EdgeTTS({
      voice: language === "tr" ? env.edgeTtsVoice : voice.edge,
      lang: language === "tr" ? env.edgeTtsLang : voice.lang,
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

async function tryElevenLabsNarration(projectDir: string, story: string, language: LanguageCode, voiceId = "") {
  if (!env.elevenLabsApiKey) {
    console.warn("ELEVENLABS_API_KEY is missing, using audio fallback.");
    return null;
  }

  try {
    const filename = `narration-${language}-elevenlabs.mp3`;
    const outputPath = path.join(projectDir, filename);
    const client = new ElevenLabsClient({ apiKey: env.elevenLabsApiKey });
    const voiceIds = uniqueVoiceIds([voiceId, env.elevenLabsVoiceId, env.elevenLabsFallbackVoiceId, "JBFqnCBsd6RMkjVDRZzb"]);
    let lastError: unknown = null;
    for (const candidateVoiceId of voiceIds) {
      try {
        await writeElevenLabsNarration(client, candidateVoiceId, story, language, projectDir, outputPath);
        const stats = await fs.stat(outputPath);
        const duration = await getAudioDurationSeconds(outputPath);
        if (stats.size > 1000 && duration >= estimateMinimumAudioSeconds(story)) return filename;
        throw new Error(`ElevenLabs audio too short: ${duration.toFixed(2)}s for ${story.length} chars.`);
      } catch (error) {
        lastError = error;
        await fs.rm(outputPath, { force: true });
        console.warn(`ElevenLabs voice ${candidateVoiceId} failed, trying next voice fallback.`, error);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("All ElevenLabs voices failed.");
  } catch (error) {
    console.warn("ElevenLabs TTS failed, using audio fallback.", error);
    return null;
  }
}

async function writeElevenLabsNarration(
  client: ElevenLabsClient,
  voiceId: string,
  story: string,
  language: LanguageCode,
  projectDir: string,
  outputPath: string
) {
  const chunks = splitForTts(story, env.elevenLabsMaxCharacters);
  if (chunks.length === 1) {
    await writeElevenLabsChunk(client, voiceId, chunks[0], outputPath);
  } else {
    const partPaths: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const partPath = path.join(projectDir, `narration-${language}-elevenlabs-part-${index + 1}.mp3`);
      await writeElevenLabsChunk(client, voiceId, chunk, partPath);
      partPaths.push(partPath);
    }
    await concatMp3Files(projectDir, partPaths, outputPath);
    await Promise.all(partPaths.map((partPath) => fs.rm(partPath, { force: true })));
  }
}

async function tryElevenLabsSceneNarration(projectDir: string, scenes: string[], language: LanguageCode, voiceId = "") {
  if (!env.elevenLabsApiKey) {
    console.warn("ELEVENLABS_API_KEY is missing, using audio fallback.");
    return null;
  }

  const filename = `narration-${language}-elevenlabs.mp3`;
  const outputPath = path.join(projectDir, filename);
  const client = new ElevenLabsClient({ apiKey: env.elevenLabsApiKey });
  const voiceIds = uniqueVoiceIds([voiceId, env.elevenLabsVoiceId, env.elevenLabsFallbackVoiceId, "JBFqnCBsd6RMkjVDRZzb"]);
  let lastError: unknown = null;

  for (const candidateVoiceId of voiceIds) {
    const partPaths: string[] = [];
    try {
      const sceneDurationsSeconds: number[] = [];
      for (const [index, scene] of scenes.entries()) {
        const partPath = path.join(projectDir, `narration-${language}-scene-${index + 1}.mp3`);
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
      console.warn(`ElevenLabs scene voice ${candidateVoiceId} failed, trying next voice fallback.`, error);
    }
  }

  console.warn("ElevenLabs scene TTS failed, using audio fallback.", lastError);
  return null;
}

function uniqueVoiceIds(voiceIds: string[]) {
  return [...new Set(voiceIds.map((id) => id.trim()).filter(Boolean))];
}

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

function splitForTts(text: string, maxCharacters: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  const limit = Math.max(800, maxCharacters - 120);
  if (clean.length <= limit) return [clean];

  const sentences = clean.match(/[^.!?。！？]+[.!?。！？]?/g) ?? [clean];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length <= limit) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length > limit) {
      chunks.push(...hardSplit(sentence.trim(), limit));
      current = "";
    } else {
      current = sentence.trim();
    }
  }

  if (current) chunks.push(current);
  return chunks.filter(Boolean);
}

function prepareNarrationText(text: string) {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/^\s*(sahne|scene)\s*\d+\s*[:.-]\s*/gim, " ")
    .replace(/^\s*(hook|bağlam|baglam|detay\s*\d*|kırılma|kirilma|sonuç|sonuc|cta)\s*[:.-]\s*/gim, " ")
    .replace(/\s+/g, " ")
    .trim();
  return fitNarrationToShortVideo(clean || "Video anlatımı hazırlanıyor.");
}

function prepareSceneNarrationText(text: string) {
  const clean = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/#[\p{L}\p{N}_-]+/gu, " ")
    .replace(/^\s*(sahne|scene)\s*\d+\s*[:.-]\s*/gim, " ")
    .replace(/^\s*(hook|bağlam|baglam|detay\s*\d*|kırılma|kirilma|sonuç|sonuc|cta)\s*[:.-]\s*/gim, " ")
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

function estimateSceneDurationsFromText(scenes: string[]) {
  return scenes.map((scene) => clamp(scene.split(/\s+/).filter(Boolean).length * 0.38 + 0.55, 2.4, 6.8));
}

function fitNarrationToShortVideo(text: string) {
  const maxWords = 44;
  const maxCharacters = 260;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords && text.length <= maxCharacters) return ensureSentenceEnding(text);

  const sentences = text.match(/[^.!?]+[.!?]?/g) ?? [text];
  let result = "";
  for (const sentence of sentences) {
    const next = `${result} ${sentence.trim()}`.trim();
    if (next.length > maxCharacters || next.split(/\s+/).length > maxWords) break;
    result = next;
  }
  if (result) return ensureSentenceEnding(result);

  return ensureSentenceEnding(words.slice(0, maxWords).join(" ").slice(0, maxCharacters).trim());
}

async function fitAudioToVideoTiming(projectDir: string, filename: string, language: LanguageCode) {
  const inputPath = path.join(projectDir, filename);
  const duration = await getAudioDurationSeconds(inputPath);
  const targetSeconds = 17.2;
  if (!duration || duration >= targetSeconds - 0.6) return filename;

  const outputFilename = `narration-${language}-synced.mp3`;
  const outputPath = path.join(projectDir, outputFilename);
  const tempo = clamp(duration / targetSeconds, 0.55, 0.96);
  const stretchedDuration = duration / tempo;
  const padSeconds = Math.max(0.25, targetSeconds - stretchedDuration);
  const filter = `atempo=${tempo.toFixed(3)},apad=pad_dur=${padSeconds.toFixed(2)},loudnorm=I=-16:TP=-1.5:LRA=11`;

  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", inputPath, "-filter:a", filter, "-t", targetSeconds.toFixed(2), "-c:a", "libmp3lame", "-b:a", "160k", outputPath],
      { timeout: 120000 }
    );
    const stats = await fs.stat(outputPath);
    if (stats.size > 1000) return outputFilename;
  } catch (error) {
    console.warn(`${language}: audio timing stretch failed; using original narration.`, error);
  }

  await fs.rm(outputPath, { force: true });
  return filename;
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

function hardSplit(text: string, limit: number) {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += limit) {
    chunks.push(text.slice(index, index + limit));
  }
  return chunks;
}

function escapeConcatPath(value: string) {
  return value.replaceAll("'", "'\\''");
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

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
