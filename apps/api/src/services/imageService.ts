import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { ensureProjectOutput, publicPathFor } from "../utils/paths.js";
import type { ScenePlan } from "./storyService.js";

type MaterialResult = {
  imagePath: string;
  prompt: string;
  provider: string;
  materialType: "ai-image" | "stock-image" | "fallback-scene";
  metadata: MaterialMetadata;
};

type MaterialMetadata = {
  sceneOrder: number;
  checked: boolean;
  qualityScore: number;
  qualityReason: string;
  promptLocked: boolean;
  consistencyGuard: string;
  providerRisk: "low" | "medium" | "high";
  reason?: string;
  query?: string;
};

// Backward-compatible helper for tests or older callers; main pipeline uses generateSceneMaterial.
export async function generateSceneImage(projectId: string, sceneOrder: number, sceneText: string, style: string) {
  const plan: ScenePlan = {
    summary: sceneText.slice(0, 140),
    visualPrompt: buildImagePrompt(sceneText, style),
    negativePrompt: "text, watermark, logo, scary, violent, low quality, blurry",
    searchTerms: ["cinematic background", "dreamy lights", "storytelling"]
  };
  return generateSceneMaterial(projectId, sceneOrder, sceneText, style, plan, "hybrid-cloud", "auto");
}

// Tries cloud providers in order and always falls back to a designed SVG scene if they fail.
export async function generateSceneMaterial(
  projectId: string,
  sceneOrder: number,
  sceneText: string,
  style: string,
  plan: ScenePlan,
  materialMode: string,
  requestedProvider: string
): Promise<MaterialResult> {
  const projectDir = await ensureProjectOutput(projectId);
  const prompt = strengthenVisualPrompt(plan.visualPrompt || buildImagePrompt(sceneText, style), sceneText, style);
  const providers = resolveProviderOrder(requestedProvider, materialMode, style);

  for (const provider of providers) {
    const generated = await tryProvider(provider, projectDir, sceneOrder, prompt, plan);
    if (generated) return generated;
  }

  return createFallbackMaterial(projectDir, projectId, sceneOrder, sceneText, style, plan, prompt);
}

// Final safety net: a local premium SVG keeps the demo from breaking when free APIs are down.
async function createFallbackMaterial(projectDir: string, projectId: string, sceneOrder: number, sceneText: string, style: string, plan: ScenePlan, prompt: string): Promise<MaterialResult> {
  const filename = `scene-${sceneOrder}.svg`;
  await fs.writeFile(path.join(projectDir, filename), createPremiumSceneSvg(sceneOrder, sceneText, style, plan), "utf8");
  return {
    imagePath: publicPathFor(projectId, filename),
    prompt,
    provider: "fallback-premium-scene",
    materialType: "fallback-scene",
    metadata: {
      sceneOrder,
      checked: true,
      qualityScore: 72,
      qualityReason: "Cloud provider başarısız oldu; sahne metnine bağlı premium fallback kompozisyonu kullanıldı.",
      promptLocked: true,
      consistencyGuard: "fallback-visual-bible",
      providerRisk: "low",
      reason: "all-cloud-providers-failed"
    }
  };
}

// Provider order stays explicit so the UI can show what source produced each scene.
function resolveProviderOrder(requestedProvider: string, materialMode: string, style: string) {
  if (requestedProvider && requestedProvider !== "auto") {
    if (requestedProvider === "designed") return ["fallback"];
    if (requestedProvider === "stock") {
      return materialMode === "stock-assisted" ? ["stock", "fallback"] : ["cloudflare", "huggingface", "pollinations", "fallback"];
    }
    return uniqueProviders([requestedProvider, "huggingface", "cloudflare", "pollinations", "fallback"]);
  }
  if (materialMode === "ai-image") return ["pollinations", "huggingface", "cloudflare", "fallback"];
  if (["cartoon", "storybook", "educational"].includes(style)) return ["pollinations", "cloudflare", "huggingface", "fallback"];
  if (materialMode === "stock-assisted") return ["stock", "cloudflare", "pollinations", "huggingface"];
  return ["pollinations", "huggingface", "cloudflare", "fallback"];
}

function uniqueProviders(providers: string[]) {
  return [...new Set(providers)];
}

async function tryProvider(provider: string, projectDir: string, sceneOrder: number, prompt: string, plan: ScenePlan) {
  if (provider === "cloudflare") return tryCloudflareImage(projectDir, sceneOrder, prompt);
  if (provider === "pollinations") return tryPollinationsImage(projectDir, sceneOrder, prompt);
  if (provider === "huggingface") return tryHuggingFaceImage(projectDir, sceneOrder, prompt);
  if (provider === "stock") return tryStockImage(projectDir, sceneOrder, plan);
  if (provider === "fallback") return null;
  return null;
}

// Builds a literal prompt from the scene text; this reduces cute/cartoon drift on simple prompts.
function buildImagePrompt(sceneText: string, style: string) {
  const styleIntent = resolvePromptStyleIntent(sceneText, style);
  const requiredSubjects = extractRequiredSubjects(sceneText);
  const sceneAction = extractSceneAction(sceneText);
  const setting = extractSimpleSetting(sceneText);
  return [
    "simple literal vertical 9:16 image",
    `foreground subjects: ${requiredSubjects}`,
    `main action: ${sceneAction}`,
    `setting: ${setting}`,
    `style: ${styleIntent}`,
    "centered composition, subjects large and clearly visible",
    "plain background, no extra characters, no unrelated objects",
    "no text, no watermark, no logo"
  ].join(", ");
}

// Adds hard subject/action/setting locks before sending the prompt to external image APIs.
function strengthenVisualPrompt(prompt: string, sceneText: string, style: string) {
  const styleIntent = resolvePromptStyleIntent(`${sceneText} ${prompt}`, style);
  const requiredSubjects = extractRequiredSubjects(sceneText);
  const sceneAction = extractSceneAction(sceneText);
  const setting = extractSimpleSetting(sceneText);
  return [
    "Generate exactly this simple scene.",
    `Foreground must show: ${requiredSubjects}.`,
    `Action must be visible: ${sceneAction}.`,
    `Background/setting must be: ${setting}.`,
    `Visual style: ${styleIntent}.`,
    "Do not add different characters, different vehicles, different locations, text, captions, signs, or logos.",
    "Keep the image simple and literal, not symbolic.",
    prompt
  ].join(", ");
}

async function tryCloudflareImage(projectDir: string, sceneOrder: number, prompt: string) {
  if (!env.cloudflareAccountId || !env.cloudflareApiToken) return null;
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.cloudflareAccountId}/ai/run/${env.cloudflareImageModel}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.cloudflareApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt, negative_prompt: negativeImagePrompt(prompt) })
    });
    const contentType = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || bytes.byteLength < 1000) throw new Error(`Cloudflare image ${response.status}`);
    const filename = `scene-${sceneOrder}-cloudflare.${contentType.includes("jpeg") ? "jpg" : "png"}`;
    await fs.writeFile(path.join(projectDir, filename), bytes);
    return result(projectDir, sceneOrder, filename, prompt, "cloudflare-workers-ai", "ai-image", "Cloudflare AI görsel üretimi başarılı; prompt sahne kilidiyle gönderildi.");
  } catch (error) {
    console.warn("Cloudflare image failed.", error);
    return null;
  }
}

async function tryPollinationsImage(projectDir: string, sceneOrder: number, prompt: string) {
  if (!env.pollinationsApiKey) return null;
  try {
    const url = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`);
    url.searchParams.set("model", env.pollinationsImageModel);
    url.searchParams.set("width", "1080");
    url.searchParams.set("height", "1920");
    url.searchParams.set("nologo", "true");
    url.searchParams.set("enhance", "true");
    url.searchParams.set("seed", String(stableSceneSeed(prompt, sceneOrder)));
    url.searchParams.set("quality", "high");
    url.searchParams.set("negative_prompt", negativeImagePrompt(prompt));
    url.searchParams.set("safe", "privacy,secrets");
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${env.pollinationsApiKey}`
      }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !contentType.startsWith("image/") || bytes.byteLength < 1000) {
      throw new Error(`Pollinations returned ${response.status} ${contentType}`);
    }
    const filename = `scene-${sceneOrder}-pollinations.${contentType.includes("jpeg") ? "jpg" : "png"}`;
    await fs.writeFile(path.join(projectDir, filename), bytes);
    return result(projectDir, sceneOrder, filename, prompt, `pollinations:${env.pollinationsImageModel}`, "ai-image", "Pollinations AI görsel üretimi başarılı; sahne promptu dikey short formatında gönderildi.");
  } catch (error) {
    console.warn("Pollinations image failed.", error);
    return null;
  }
}

async function tryHuggingFaceImage(projectDir: string, sceneOrder: number, prompt: string) {
  if (!env.huggingFaceToken) return null;
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
          negative_prompt: negativeImagePrompt(prompt)
        },
        options: { wait_for_model: true }
      })
    });
    const contentType = response.headers.get("content-type") ?? "";
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !contentType.startsWith("image/") || bytes.byteLength < 1000) throw new Error(`HF ${response.status}`);
    const filename = `scene-${sceneOrder}-hf.${contentType.includes("jpeg") ? "jpg" : "png"}`;
    await fs.writeFile(path.join(projectDir, filename), bytes);
    return result(projectDir, sceneOrder, filename, prompt, `huggingface:${env.huggingFaceImageModel}`, "ai-image", "Hugging Face inference görsel üretimi başarılı; tutarlılık promptu korundu.");
  } catch (error) {
    console.warn("Hugging Face image failed.", error);
    return null;
  }
}

async function tryStockImage(projectDir: string, sceneOrder: number, plan: ScenePlan) {
  const query = plan.searchTerms[0] || plan.summary || "cinematic background";
  return (await tryPexels(projectDir, sceneOrder, query)) ?? (await tryPixabay(projectDir, sceneOrder, query));
}

function extractRequiredSubjects(source: string) {
  const lower = source.toLocaleLowerCase("tr-TR");
  const subjects: string[] = [];
  if (/\bkedi\b|\bcat\b/.test(lower)) subjects.push("one cat clearly visible");
  if (/\bköpek\b|\bkopek\b|\bdog\b/.test(lower)) subjects.push("one dog clearly visible");
  if (/mars/.test(lower)) subjects.push("red Mars landscape clearly visible");
  if (/uzay gemisi|\bspaceship\b|\bspace ship\b|roket|\brocket\b/.test(lower)) subjects.push("small futuristic spaceship clearly visible");
  if (/uzay|\bspace\b|\bastronaut\b|\bspace suit\b|\bspacesuit\b/.test(lower)) subjects.push("futuristic space suits or sci-fi space details");
  if (/kano|\bcanoe\b|\bkayak\b/.test(lower)) subjects.push("small canoe clearly visible");
  if (/koy|\bbay\b|sahil|\bbeach\b|\bsea\b|deniz/.test(lower)) subjects.push("coastline or water clearly visible");
  if (/kalem|\bpen\b/.test(lower)) subjects.push("the pen product clearly visible");
  if (/araba|\bcar\b|otomobil/.test(lower)) subjects.push("the car clearly visible");
  if (/çocuk|cocuk|\bchild\b|\bboy\b|\bgirl\b/.test(lower)) subjects.push("the child clearly visible");
  if (!subjects.length) subjects.push("the main subject described by the prompt clearly visible");
  return subjects.join("; ");
}

function extractSceneAction(source: string) {
  const scene = extractSceneLine(source);
  return scene || "the main subject is clearly shown";
}

function extractSimpleSetting(source: string) {
  const lower = source.toLocaleLowerCase("tr-TR");
  if (/mars/.test(lower)) return "red Mars surface, simple sci-fi background";
  if (/showroom|galeri|car showroom|araba/.test(lower)) return "modern car showroom or simple city street";
  if (/yağmur|yagmur|rain|rainy/.test(lower)) return "rainy modern city street";
  if (/okul|school/.test(lower)) return "simple school street";
  if (/sokak|street/.test(lower)) return "simple street background";
  if (/koy|bay|sahil|beach|deniz|sea/.test(lower)) return "calm sea shore or small bay";
  if (/orman|forest/.test(lower)) return "simple forest background";
  if (/ev|home|room|oda/.test(lower)) return "simple home interior";
  return "simple background matching the user prompt";
}

function extractSceneLine(source: string) {
  const lines = source.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sceneLine = [...lines].reverse().find((line) => /^scene\s*\d+\s*:/i.test(line));
  const value = (sceneLine || lines.at(-1) || source)
    .replace(/^scene\s*\d+\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return value.length > 120 ? `${value.slice(0, 116).trim()}...` : value;
}

function stableSceneSeed(prompt: string, sceneOrder: number) {
  let hash = 2166136261 + sceneOrder * 101;
  for (const char of prompt) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 1000000);
}

function negativeImagePrompt(prompt = "") {
  const lower = prompt.toLocaleLowerCase("tr-TR");
  const allowsStylized = /cartoon|anime|illustration|illustrated|storybook|stylized|çizgi|cizgi|masal/.test(lower);
  const allowsConceptArt = /futuristic|cyberpunk|sci[- ]?fi|concept art|neon|robot|space|mars|fütüristik/.test(lower);
  const base = [
    "text",
    "watermark",
    "logo",
    "caption",
    "blurry",
    "low quality",
    "childlike",
    "toy",
    "pixar",
    "plastic skin",
    "oversized eyes",
    "distorted face",
    "extra limbs",
    "crowd",
    "busy background",
    "complex scene",
    "multiple unrelated subjects",
    "different scene",
    "symbolic image",
    "abstract art"
  ];
  if (!allowsStylized) base.push("cartoon", "anime", "children book illustration", "cute kids style");
  if (!allowsConceptArt) base.push("generic sci-fi background", "unrelated neon city");
  return base.join(", ");
}

function resolvePromptStyleIntent(source: string, style: string) {
  const lower = `${source} ${style}`.toLocaleLowerCase("tr-TR");
  if (/fütüristik|futuristic|cyberpunk|sci[- ]?fi|bilim kurgu|gelecek|neon|robot|mars|uzay|space|hologram/.test(lower)) {
    return "futuristic cinematic sci-fi style, high-tech architecture or environment, neon accents, advanced materials, dramatic lighting, not a cute cartoon";
  }
  if (/ürün|urun|\bproduct\b|reklam|\bcommercial\b|tanıtım|tanitim|kalem|araba|\bcar\b|\bdealership\b/.test(lower)) {
    return "premium realistic commercial style, real-world product/lifestyle photography, clean modern composition, natural reflections and materials";
  }
  if (/çizgi film|cizgi film|cartoon|anime|storybook|masal|illustration|illustrated/.test(lower)) {
    return "explicitly requested stylized animation or illustration, cohesive premium style, not generic childish clipart";
  }
  if (/gerçekçi|gercekci|realistic|photoreal|fotoğraf|fotograf|documentary|belgesel|ugc|street|sokak/.test(lower)) {
    return "photorealistic cinematic documentary style, real camera lens, natural skin/fur texture, believable street or indoor environment";
  }
  return "prompt-directed cinematic style, photorealistic by default, no generic cartoon or childlike animation";
}

async function tryPexels(projectDir: string, sceneOrder: number, query: string) {
  if (!env.pexelsApiKey) return null;
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.set("query", query);
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("per_page", "3");
    const response = await fetch(url, { headers: { Authorization: env.pexelsApiKey } });
    if (!response.ok) throw new Error(`Pexels ${response.status}`);
    const body = (await response.json()) as { photos?: Array<{ src?: { large2x?: string; large?: string }; alt?: string }> };
    const src = body.photos?.find((photo) => photo.src?.large2x || photo.src?.large)?.src;
    const imageUrl = src?.large2x || src?.large;
    if (!imageUrl) return null;
    const filename = await downloadImage(projectDir, sceneOrder, imageUrl, "pexels");
    return result(projectDir, sceneOrder, filename, query, "pexels", "stock-image", "Stok destekli modda Pexels sonucu seçildi; genel sahnelerde kullanılmalı.", { query });
  } catch (error) {
    console.warn("Pexels stock image failed.", error);
    return null;
  }
}

async function tryPixabay(projectDir: string, sceneOrder: number, query: string) {
  if (!env.pixabayApiKey) return null;
  try {
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.set("key", env.pixabayApiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("image_type", "photo");
    url.searchParams.set("orientation", "horizontal");
    url.searchParams.set("per_page", "3");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Pixabay ${response.status}`);
    const body = (await response.json()) as { hits?: Array<{ largeImageURL?: string; webformatURL?: string }> };
    const imageUrl = body.hits?.find((hit) => hit.largeImageURL || hit.webformatURL)?.largeImageURL;
    if (!imageUrl) return null;
    const filename = await downloadImage(projectDir, sceneOrder, imageUrl, "pixabay");
    return result(projectDir, sceneOrder, filename, query, "pixabay", "stock-image", "Stok destekli modda Pixabay sonucu seçildi; genel sahnelerde kullanılmalı.", { query });
  } catch (error) {
    console.warn("Pixabay stock image failed.", error);
    return null;
  }
}

async function downloadImage(projectDir: string, sceneOrder: number, imageUrl: string, provider: string) {
  const response = await fetch(imageUrl);
  const contentType = response.headers.get("content-type") ?? "";
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!response.ok || !contentType.startsWith("image/") || bytes.byteLength < 1000) throw new Error(`${provider} image download failed`);
  const filename = `scene-${sceneOrder}-${provider}.${contentType.includes("png") ? "png" : "jpg"}`;
  await fs.writeFile(path.join(projectDir, filename), bytes);
  return filename;
}

function result(
  _projectDir: string,
  sceneOrder: number,
  filename: string,
  prompt: string,
  provider: string,
  materialType: "ai-image" | "stock-image" | "fallback-scene",
  qualityReason: string,
  extraMetadata: Partial<MaterialMetadata> = {}
): MaterialResult {
  const qualityScore = estimateMaterialQuality(materialType, provider, prompt);
  return {
    imagePath: publicPathFor(path.basename(_projectDir), filename),
    prompt,
    provider,
    materialType,
    metadata: {
      sceneOrder,
      checked: true,
      qualityScore,
      qualityReason,
      promptLocked: prompt.includes("Scene subject lock"),
      consistencyGuard: materialType === "stock-image" ? "stock-assisted" : "visual-bible",
      providerRisk: materialType === "stock-image" ? "medium" : "low",
      ...extraMetadata
    }
  };
}

function estimateMaterialQuality(materialType: MaterialResult["materialType"], provider: string, prompt: string) {
  let score = materialType === "ai-image" ? 86 : materialType === "fallback-scene" ? 72 : 64;
  if (provider.includes("cloudflare")) score += 3;
  if (provider.includes("huggingface")) score += 2;
  if (prompt.includes("Scene subject lock")) score += 4;
  if (prompt.includes("no text") && prompt.includes("no watermark")) score += 2;
  if (prompt.includes("photorealistic") || prompt.includes("real-world")) score += 3;
  if (materialType === "stock-image" && prompt.split(/\s+/).length < 5) score -= 8;
  return Math.max(35, Math.min(96, score));
}

function createPremiumSceneSvg(_order: number, sceneText: string, style: string, plan: ScenePlan) {
  const escapedText = escapeXml(sceneText);
  const escapedSummary = escapeXml(plan.summary);
  const palette = style === "educational" ? ["#303846", "#1f4f8f", "#22a7a1"] : ["#2f343d", "#132b4d", "#657184"];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="${palette[0]}"/>
      <stop offset="58%" stop-color="${palette[1]}"/>
      <stop offset="100%" stop-color="${palette[2]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="36%" r="62%">
      <stop offset="0%" stop-color="#e0f2fe" stop-opacity=".25"/>
      <stop offset="50%" stop-color="#38bdf8" stop-opacity=".1"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="34"/></filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#bg)"/>
  <rect width="1080" height="1920" fill="url(#glow)"/>
  <path d="M-80 1380 C190 1185 405 1465 642 1270 C828 1118 955 1184 1120 1040 L1120 1920 L-80 1920 Z" fill="#e2e8f0" opacity=".08"/>
  <path d="M92 270 C232 140 405 154 548 287 C690 420 780 392 920 226 C1000 132 1104 122 1160 162" fill="none" stroke="#bfdbfe" stroke-width="3" opacity=".24"/>
  <circle cx="850" cy="280" r="190" fill="#38bdf8" opacity=".14" filter="url(#soft)"/>
  <circle cx="160" cy="1510" r="250" fill="#14b8a6" opacity=".12" filter="url(#soft)"/>
  <circle cx="930" cy="1480" r="185" fill="#f8fafc" opacity=".07" filter="url(#soft)"/>
  <rect x="70" y="250" width="940" height="1220" rx="38" fill="#111827" opacity=".46" stroke="#dbeafe" stroke-opacity=".18"/>
  <rect x="110" y="320" width="92" height="5" rx="3" fill="#93c5fd" opacity=".95"/>
  <text x="110" y="430" fill="#f8fafc" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="850">${escapedSummary}</text>
  ${wrapSvgText(escapedText)}
  <rect x="110" y="1350" width="260" height="2" rx="1" fill="#99f6e4" opacity=".55"/>
  <circle cx="850" cy="1342" r="46" fill="#f8fafc" opacity=".08"/>
  <circle cx="888" cy="1384" r="18" fill="#99f6e4" opacity=".5"/>
</svg>`;
}

function wrapSvgText(text: string) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = `${line} ${word}`.trim();
    if (next.length > 28) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines
    .slice(0, 4)
    .map((item, index) => `<text x="110" y="${650 + index * 74}" fill="#e5e7eb" font-family="Inter, Arial, sans-serif" font-size="48" font-weight="780">${item}</text>`)
    .join("\n");
}

function escapeXml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
