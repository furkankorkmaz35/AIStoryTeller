import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

export async function generateSceneImage(projectId: string, sceneOrder: number, sceneText: string, style: string) {
  const projectDir = await ensureProjectOutput(projectId);
  const prompt = buildImagePrompt(sceneText, style);

  if (env.imageProvider === "huggingface" || env.imageProvider === "auto") {
    const image = await tryHuggingFaceImage(projectDir, sceneOrder, prompt);
    if (image) {
      return { imagePath: publicPathFor(projectId, image.filename), prompt, provider: image.provider };
    }
  }

  const filename = `scene-${sceneOrder}.svg`;
  await fs.writeFile(path.join(projectDir, filename), createSceneSvg(sceneOrder, sceneText, style), "utf8");
  return { imagePath: publicPathFor(projectId, filename), prompt, provider: "fallback-svg" };
}

function buildImagePrompt(sceneText: string, style: string) {
  return [
    "high quality children's storybook illustration",
    `${style} style`,
    "warm cinematic lighting",
    "safe for children",
    "wide 16:9 composition",
    "no text, no watermark, no logo",
    sceneText
  ].join(", ");
}

async function tryHuggingFaceImage(projectDir: string, sceneOrder: number, prompt: string) {
  if (!env.huggingFaceToken) {
    console.warn("HF_TOKEN is missing, using image fallback.");
    return null;
  }

  const endpoint = `${env.huggingFaceInferenceBaseUrl.replace(/\/$/, "")}/${env.huggingFaceImageModel}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.huggingFaceToken}`,
        "Content-Type": "application/json",
        Accept: "image/png"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          width: 1280,
          height: 720,
          num_inference_steps: env.huggingFaceImageSteps,
          guidance_scale: env.huggingFaceGuidanceScale,
          negative_prompt: "text, watermark, logo, scary, violent, low quality, blurry"
        },
        options: {
          wait_for_model: true
        }
      })
    });

    const contentType = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());

    if (!response.ok) {
      const details = contentType.includes("application/json") ? bytes.toString("utf8") : response.statusText;
      throw new Error(`Hugging Face API ${response.status}: ${details}`);
    }

    if (!contentType.startsWith("image/") || bytes.byteLength < 1000) {
      throw new Error(`Hugging Face API returned non-image response: ${contentType}`);
    }

    const extension = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
    const filename = `scene-${sceneOrder}.${extension}`;
    await fs.writeFile(path.join(projectDir, filename), bytes);
    return { filename, provider: `huggingface:${env.huggingFaceImageModel}` };
  } catch (error) {
    console.warn("Hugging Face image generation failed, using SVG fallback.", error);
    return null;
  }
}

function createSceneSvg(order: number, sceneText: string, style: string) {
  const escapedText = escapeXml(sceneText);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#101828"/>
      <stop offset="50%" stop-color="#154E4A"/>
      <stop offset="100%" stop-color="#7C3AED"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#020617" flood-opacity="0.45"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <circle cx="1030" cy="140" r="92" fill="#FDE68A" opacity=".75"/>
  <path d="M0 570 C220 470 420 650 650 540 C890 424 1040 492 1280 420 L1280 720 L0 720 Z" fill="#0F766E" opacity=".74"/>
  <path d="M0 632 C180 536 400 705 650 590 C880 484 1040 578 1280 508 L1280 720 L0 720 Z" fill="#F97316" opacity=".45"/>
  <g filter="url(#shadow)">
    <rect x="84" y="86" width="1112" height="548" rx="26" fill="#111827" fill-opacity="0.78" stroke="#FDE68A" stroke-opacity="0.5"/>
    <text x="128" y="172" fill="#FDE68A" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">SAHNE ${order}</text>
    <text x="128" y="224" fill="#A7F3D0" font-family="Inter, Arial, sans-serif" font-size="22">${escapeXml(style.toUpperCase())} VIDEO FRAME</text>
    ${wrapSvgText(escapedText)}
  </g>
</svg>`;
}

function wrapSvgText(text: string) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = `${line} ${word}`.trim();
    if (next.length > 62) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  return lines
    .slice(0, 5)
    .map((item, index) => `<text x="128" y="${326 + index * 50}" fill="#F8FAFC" font-family="Inter, Arial, sans-serif" font-size="31">${item}</text>`)
    .join("\n");
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
