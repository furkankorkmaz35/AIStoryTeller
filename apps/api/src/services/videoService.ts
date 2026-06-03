import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { env } from "../config/env.js";
import { apiRoot, ensureProjectOutput, outputsRoot, publicPathFor } from "../utils/paths.js";
import type { VideoProps } from "../remotion/types.js";

const execFileAsync = promisify(execFile);
const fps = 30;

// Tek final MP4 üretir; zaman çizelgesinde ana kaynak olarak ses süresi ve sahne süreleri kullanılır.
export async function renderProjectVideo(projectId: string, props: Omit<VideoProps, "apiBaseUrl">, outputName = "final.mp4") {
  const projectDir = await ensureProjectOutput(projectId);
  const outputLocation = path.join(projectDir, outputName);
  const rawOutputLocation = path.join(projectDir, `raw-${outputName}`);
  const entryPoint = path.join(apiRoot, "src/remotion/index.ts");
  const audioSeconds = await getAudioDurationSeconds(projectId, props.audioPath);
  const sceneDurationsInFrames = resolveSceneDurationsInFrames(props.scenes.length, props.sceneDurationsInFrames);
  const durationInFrames = sceneDurationsInFrames.length ? sceneDurationsInFrames.reduce((total, value) => total + value, 0) : resolveDurationInFrames(props.scenes.length, audioSeconds);
  const sceneDurationInFrames = Math.ceil(durationInFrames / Math.max(props.scenes.length, 1));
  const bundled = await bundle({ entryPoint, webpackOverride: (config) => config });
  const inputProps: VideoProps = { ...props, apiBaseUrl: env.publicApiBaseUrl, sceneDurationInFrames, sceneDurationsInFrames };
  process.env.PUBLIC_API_BASE_URL = env.publicApiBaseUrl;
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "AiVideo",
    inputProps
  });

  await renderMedia({
    composition: {
      ...composition,
      ...renderSize(props.aspectRatio),
      durationInFrames
    },
    serveUrl: bundled,
    codec: "h264",
    outputLocation: rawOutputLocation,
    inputProps
  });

  await enhanceRenderedVideo(rawOutputLocation, outputLocation, props.aspectRatio);
  await fs.rm(rawOutputLocation, { force: true });

  return publicPathFor(projectId, outputName);
}

// Sahne bazlı ses süreleri sayesinde altyazı, görsel geçişi ve anlatım birbirinden kopmadan senkron kalır.
function resolveSceneDurationsInFrames(sceneCount: number, sceneDurationsInFrames?: number[]) {
  if (!sceneDurationsInFrames?.length) return [];
  const safeSceneCount = Math.max(sceneCount, 1);
  return Array.from({ length: safeSceneCount }, (_, index) => clamp(Math.round(sceneDurationsInFrames[index] || 0), 72, 240));
}

async function getAudioDurationSeconds(projectId: string, audioPath?: string) {
  if (!audioPath) return 0;
  const filename = path.basename(audioPath);
  const localPath = path.join(outputsRoot, projectId, filename);
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      localPath
    ]);
    const duration = Number(String(stdout).trim());
    return Number.isFinite(duration) ? duration : 0;
  } catch (error) {
    console.warn("Audio duration could not be detected; using scene-based render duration.", error);
    return 0;
  }
}

// Provider beklenenden uzun ses döndürse bile demo videosunun kısa kalması için üst süre sınırı uygulanır.
function resolveDurationInFrames(sceneCount: number, audioSeconds: number) {
  const safeSceneCount = Math.max(sceneCount, 1);
  const targetSeconds = safeSceneCount <= 3 ? 18 : safeSceneCount === 4 ? 20 : safeSceneCount === 5 ? 20 : 20;
  const audioTargetSeconds = audioSeconds > 0 ? audioSeconds + 1.2 : targetSeconds;
  const durationSeconds = clamp(Math.max(targetSeconds, audioTargetSeconds), 18, 20);
  return Math.ceil(durationSeconds * fps);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function renderSize(aspectRatio: VideoProps["aspectRatio"]) {
  if (aspectRatio === "16:9") return { width: 1920, height: 1080 };
  if (aspectRatio === "1:1") return { width: 1080, height: 1080 };
  return { width: 1080, height: 1920 };
}

// Son ffmpeg geçişi görüntüyü keskinleştirir, renkleri toparlar ve sesi sosyal medya oynatımı için normalize eder.
async function enhanceRenderedVideo(inputPath: string, outputPath: string, aspectRatio: VideoProps["aspectRatio"]) {
  const { width, height } = renderSize(aspectRatio);
  const hasAudio = await hasAudioStream(inputPath);
  const videoFilter = [
    `scale=${width}:${height}:flags=lanczos`,
    "eq=contrast=1.06:saturation=1.08:brightness=0.006",
    "unsharp=5:5:0.32:3:3:0.12",
    "vignette=PI/5",
    "format=yuv420p"
  ].join(",");
  const args = [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-vf",
    videoFilter,
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "18",
    "-movflags",
    "+faststart"
  ];

  if (hasAudio) {
    args.push("-map", "0:a:0", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-b:a", "192k");
  }

  args.push(outputPath);

  try {
    await execFileAsync("ffmpeg", args, { timeout: 180000 });
  } catch (error) {
    console.warn("FFmpeg enhancement failed; using raw Remotion render.", error);
    await fs.rm(outputPath, { force: true });
    await fs.rename(inputPath, outputPath);
  }
}

async function hasAudioStream(inputPath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", inputPath]);
    return String(stdout).trim().length > 0;
  } catch {
    return false;
  }
}
