import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { env } from "../config/env.js";
import { apiRoot, ensureProjectOutput, publicPathFor } from "../utils/paths.js";
import type { VideoProps } from "../remotion/types.js";

export async function renderProjectVideo(projectId: string, props: Omit<VideoProps, "apiBaseUrl">) {
  const projectDir = await ensureProjectOutput(projectId);
  const outputLocation = path.join(projectDir, "final.mp4");
  const entryPoint = path.join(apiRoot, "src/remotion/index.ts");
  const bundled = await bundle({ entryPoint, webpackOverride: (config) => config });
  const inputProps: VideoProps = { ...props, apiBaseUrl: env.publicApiBaseUrl };
  process.env.PUBLIC_API_BASE_URL = env.publicApiBaseUrl;
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "AiVideo",
    inputProps
  });

  await renderMedia({
    composition: {
      ...composition,
      durationInFrames: Math.max(props.scenes.length * 150, 450)
    },
    serveUrl: bundled,
    codec: "h264",
    outputLocation,
    inputProps
  });

  return publicPathFor(projectId, "final.mp4");
}
