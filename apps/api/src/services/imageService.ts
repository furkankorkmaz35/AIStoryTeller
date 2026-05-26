import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";

export async function generateSceneImage(projectId: string, sceneOrder: number, sceneText: string, style: string) {
  const filename = `scene-${sceneOrder}.svg`;
  const projectDir = await ensureProjectOutput(projectId);
  const filePath = path.join(projectDir, filename);
  const prompt = `children storybook ${style} scene, cinematic dark navy and teal lighting: ${sceneText}`;

  if (env.imageProvider !== "fallback") {
    try {
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 900))}?width=1280&height=720&nologo=true&enhance=true`;
      const response = await fetch(url, { headers: { "User-Agent": "AIStoryTeller/2.0" } });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > 1000) {
          const jpgName = `scene-${sceneOrder}.jpg`;
          await fs.writeFile(path.join(projectDir, jpgName), Buffer.from(arrayBuffer));
          return { imagePath: publicPathFor(projectId, jpgName), prompt, provider: "pollinations" };
        }
      }
    } catch (error) {
      console.warn("Image provider failed, using SVG fallback.", error);
    }
  }

  await fs.writeFile(filePath, createSceneSvg(sceneOrder, sceneText, style), "utf8");
  return { imagePath: publicPathFor(projectId, filename), prompt, provider: "fallback-svg" };
}

function createSceneSvg(order: number, sceneText: string, style: string) {
  const escapedText = escapeXml(sceneText);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="0">
      <stop offset="0%" stop-color="#090B10"/>
      <stop offset="42%" stop-color="#0B1B3A"/>
      <stop offset="100%" stop-color="#102A56"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="35%" r="55%">
      <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.55"/>
      <stop offset="42%" stop-color="#14B8A6" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#090B10" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="24" stdDeviation="24" flood-color="#020617" flood-opacity="0.55"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect width="1280" height="720" fill="url(#glow)"/>
  <path d="M-40 520 C 170 430, 340 610, 565 500 S 960 360, 1340 455" fill="none" stroke="#38BDF8" stroke-opacity="0.25" stroke-width="3"/>
  <path d="M-20 575 C 240 445, 420 645, 690 540 S 1040 410, 1330 520" fill="none" stroke="#14B8A6" stroke-opacity="0.34" stroke-width="5"/>
  <g filter="url(#shadow)">
    <rect x="86" y="92" width="1108" height="536" rx="30" fill="#111827" fill-opacity="0.76" stroke="#38BDF8" stroke-opacity="0.36"/>
    <text x="128" y="176" fill="#38BDF8" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">SAHNE ${order}</text>
    <text x="128" y="228" fill="#94A3B8" font-family="Inter, Arial, sans-serif" font-size="22">${escapeXml(style.toUpperCase())} AI VIDEO FRAME</text>
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
    .map((item, index) => `<text x="128" y="${326 + index * 50}" fill="#E5E7EB" font-family="Inter, Arial, sans-serif" font-size="31">${item}</text>`)
    .join("\n");
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
