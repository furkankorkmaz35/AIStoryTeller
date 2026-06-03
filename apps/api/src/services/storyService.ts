import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

export type GeneratedStory = {
  title: string;
  story: string;
  scenes: string[];
};

export type LanguageCode = "tr" | "en" | "de" | "es";

export const supportedLanguages: LanguageCode[] = ["tr", "en", "de", "es"];

export const languageLabels: Record<LanguageCode, string> = {
  tr: "Türkçe",
  en: "English",
  de: "Deutsch",
  es: "Español"
};

export type ScenePlan = {
  summary: string;
  visualPrompt: string;
  negativePrompt: string;
  searchTerms: string[];
};

export type VariantCopy = {
  language: LanguageCode;
  title: string;
  story: string;
  scenes: string[];
  exportCaption: string;
  exportHashtags: string[];
};

export function resolveSceneCountForContent(content: string, requestedCount?: number | null) {
  return 3;
}

export async function generateStory(theme: string, style: string, ageGroup: string, sceneCount: number): Promise<GeneratedStory> {
  const prompt = buildStoryPrompt(theme, style, ageGroup, sceneCount);
  const providers = env.aiProvider === "auto" ? ["groq", "gemini"] : [env.aiProvider];

  for (const provider of providers) {
    if (provider === "groq" && env.groqApiKey) {
      const story = await tryGroqStory(prompt, sceneCount);
      if (story) return story;
    }

    if (provider === "gemini" && env.geminiApiKey) {
      const story = await tryGeminiStory(prompt, sceneCount);
      if (story) return story;
    }
  }

  return fallbackStory(theme, style, ageGroup, sceneCount);
}

export async function generateScenePlans(theme: string, style: string, scenes: string[]): Promise<ScenePlan[]> {
  const visualProfile = buildVisualProfile(theme, style);
  const subjectLock = buildCoreSubjectLock(theme, scenes);
  const styleIntent = buildPromptStyleIntent(theme, style);
  const prompt = [
    "Aşağıdaki video sahneleri için kaliteli görsel üretim planı hazırla.",
    "Sadece geçerli JSON dön. Markdown kullanma.",
    "Her sahne için: summary, visualPrompt, negativePrompt, searchTerms alanları olsun.",
    "Görsel dili kullanıcı promptundan çıkar; fütüristik yazıyorsa fütüristik, gerçekçi yazıyorsa gerçekçi, çizgi film yazıyorsa çizgi film olmalı.",
    "Ana karakterleri/nesneleri/mekanı görünür tut; promptta geçen ana nesneleri asla çıkarma veya alakasız arka planla değiştirme.",
    "Her visualPrompt sahnedeki aksiyonu, karakterleri, mekanı ve stil niyetini tek karede açıkça tarif etmeli.",
    "Stili aşırı kısıtlama ama konu eşleşmesini sert tut: prompt Mars diyorsa Mars, kedi diyorsa kedi, köpek diyorsa köpek görünmeli.",
    "visualPrompt mutlaka tamamen İngilizce yazılsın; Türkçe kelime, altyazı, başlık veya ekranda metin isteme.",
    "visualPrompt yüksek kalite, metinsiz, logosuz ve sosyal medya videosuna uygun olsun.",
    "searchTerms stok medya aramak için 2-4 kısa İngilizce terim içersin.",
    `Görsel yön: ${visualProfile}`,
    `Kullanıcı stil niyeti: ${styleIntent}`,
    `Ana konu kilidi: ${subjectLock}`,
    `Tema: ${theme}`,
    `Stil: ${style}`,
    `Sahneler: ${JSON.stringify(scenes)}`
  ].join("\n");

  const generated = await tryGroqJson<{ scenes?: ScenePlan[] }>(prompt, "Sen video prodüksiyonunda güçlü görsel yönetmenlik yapan bir asistansın.");
  if (generated?.scenes?.length) {
    return scenes.map((scene, index) => normalizeScenePlan(generated.scenes?.[index], scene, style, visualProfile, subjectLock, styleIntent));
  }
  return scenes.map((scene) => normalizeScenePlan(null, scene, style, visualProfile, subjectLock, styleIntent));
}

export async function generateLanguageVariants(story: GeneratedStory, languages: LanguageCode[], targetPlatform: string): Promise<VariantCopy[]> {
  const variants: VariantCopy[] = [];
  for (const language of languages) {
    if (language === "tr") {
      variants.push({
        language,
        title: story.title,
        story: story.story,
        scenes: story.scenes,
        exportCaption: `${story.title}\n\n${story.story.slice(0, 180)}`,
        exportHashtags: defaultHashtags(language, targetPlatform)
      });
      continue;
    }

    const prompt = [
      `Translate and localize this short social video story to ${languageLabels[language]}.`,
      "Keep it natural, warm, short, and suitable for voiceover.",
      "Return only valid JSON without markdown.",
      "Schema: {\"title\":\"...\",\"story\":\"...\",\"scenes\":[\"...\"],\"exportCaption\":\"...\",\"exportHashtags\":[\"...\"]}.",
      `Target platform: ${targetPlatform}`,
      `Source title: ${story.title}`,
      `Source story: ${story.story}`,
      `Source scenes: ${JSON.stringify(story.scenes)}`
    ].join("\n");

    const translated = await tryGroqJson<Omit<VariantCopy, "language">>(
      prompt,
      "You are a precise multilingual video localization assistant."
    );
    variants.push({
      language,
      title: translated?.title || fallbackLocalizedTitle(story.title, language),
      story: translated?.story || story.story,
      scenes: translated?.scenes?.length ? translated.scenes.slice(0, story.scenes.length) : story.scenes,
      exportCaption: translated?.exportCaption || fallbackLocalizedTitle(story.title, language),
      exportHashtags: translated?.exportHashtags?.length ? translated.exportHashtags.slice(0, 8) : defaultHashtags(language, targetPlatform)
    });
  }
  return variants;
}

export async function generateExportCopy(title: string, story: string, language: LanguageCode, targetPlatform: string) {
  const prompt = [
    `Create social media export copy in ${languageLabels[language]}.`,
    "Return only valid JSON: {\"caption\":\"...\",\"hashtags\":[\"...\"]}.",
    "Caption must be short, punchy and social-first: 1 hook sentence, 1 context sentence, 1 CTA.",
    "Do not sound like an AI assistant, a news bulletin, or a school essay.",
    `Platform: ${targetPlatform}`,
    `Title: ${title}`,
    `Story: ${story}`
  ].join("\n");
  const generated = await tryGroqJson<{ caption?: string; hashtags?: string[] }>(prompt, "You write concise social captions.");
  return {
    caption: generated?.caption || `${title}\n\n${story.slice(0, 180)}`,
    hashtags: generated?.hashtags?.length ? generated.hashtags.slice(0, 8) : defaultHashtags(language, targetPlatform)
  };
}

function buildStoryPrompt(theme: string, style: string, ageGroup: string, sceneCount: number) {
  return [
    "Türkçe, 15-20 saniyelik dikey video için çok basit ve tutarlı bir mini hikaye üret.",
    "Kullanıcının promptu tek kaynak kabul edilecek; konu, karakter, mekan, tür ve stil dışına çıkma.",
    "Promptta geçen ana nesneler her sahnede mantıklı şekilde korunmalı. Örneğin kedi/köpek/Mars/uzay gemisi yazıyorsa hikaye bunları terk etmemeli.",
    "Yeni karakter, alakasız mekan, haber/gündem dili, okul ödevi dili, yapay zeka dili veya 'Sahne 1' gibi etiketler ekleme.",
    "Hikaye akışı: sahne 1 giriş ve ortam, sahne 2 keşif/olay, sahne 3 sonuç/duygu.",
    "Her scene hem altyazı hem seslendirme hem de görsel promptun ana kaynağı olacak.",
    "Bu yüzden her scene tek cümle, tek mekan, tek ana aksiyon ve somut görünen nesneler içermeli.",
    "Karmaşık yan olay, soyut duygu, metafor, çok fazla sıfat veya birden fazla aksiyon yazma.",
    `Kullanıcı promptu: ${theme}`,
    `Görsel stil ipucu: ${style}`,
    `Hedef yas/ton referansi: ${ageGroup}`,
    `Tam olarak ${sceneCount} kısa sahne yaz.`,
    "Sadece gecerli JSON don. Markdown kullanma.",
    "JSON semasi: {\"title\":\"...\",\"story\":\"...\",\"scenes\":[\"sadece metin\", \"sadece metin\", \"sadece metin\"]}.",
    "story 180 karakteri ve 30 kelimeyi geçmesin.",
    "Her scene 62 karakteri ve 9 kelimeyi geçmesin.",
    "Her scene mümkünse şu biçime yakın olsun: 'Kedi ve köpek Mars yüzeyinde yürür.'",
    "scenes dizisi story ile aynı olayı aynı sırada anlatmalı; altyazı/ses/görsel arasında anlam farkı olmamalı.",
    "scenes sadece string metin dizisi olsun ve sahne sayisi istenen sayiya esit olsun."
  ].join("\n");
}

async function tryGeminiStory(prompt: string, sceneCount: number) {
  try {
    const genAI = new GoogleGenerativeAI(env.geminiApiKey);
    const model = genAI.getGenerativeModel({ model: env.geminiModel });
    const result = await model.generateContent(prompt);
    return parseGeneratedStory(result.response.text(), sceneCount);
  } catch (error) {
    console.warn("Gemini story generation failed, trying next provider.", error);
    return null;
  }
}

async function tryGroqStory(prompt: string, sceneCount: number) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.38,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Sen kullanici promptuna sadik kalan, kisa video icin net sahneler ve dogal Turkce seslendirme cumleleri yazan bir senaristsin."
          },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) {
      throw new Error(`Groq API ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return parseGeneratedStory(body.choices?.[0]?.message?.content ?? "", sceneCount);
  } catch (error) {
    console.warn("Groq story generation failed, trying next provider.", error);
    return null;
  }
}

async function tryGroqJson<T>(prompt: string, system: string): Promise<T | null> {
  if (!env.groqApiKey || !["auto", "groq"].includes(env.aiProvider)) return null;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.55,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) throw new Error(`Groq API ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return JSON.parse((body.choices?.[0]?.message?.content ?? "{}").trim()) as T;
  } catch (error) {
    console.warn("Groq JSON helper failed.", error);
    return null;
  }
}

function normalizeScenePlan(
  plan: ScenePlan | null | undefined,
  scene: string,
  style: string,
  visualProfile = buildVisualProfile(scene, style),
  subjectLock = buildCoreSubjectLock(scene, [scene]),
  styleIntent = buildPromptStyleIntent(scene, style)
): ScenePlan {
  const rawPrompt = plan?.visualPrompt || [
    "high quality cinematic social video frame",
    `${style} style`,
    "premium editorial lighting, elegant composition, no text, no logo, no watermark",
    scene
  ].join(", ");
  return {
    summary: plan?.summary || scene.slice(0, 140),
    visualPrompt: [
      visualProfile,
      subjectLock,
      styleIntent,
      "Write this image prompt in English only.",
      `Scene action must be visible: ${translateVisualCue(scene)}`,
      "Keep the main subjects recognizable across scenes, but follow the user's requested genre and atmosphere without over-constraining the style.",
      rawPrompt
    ].join(", "),
    negativePrompt: [
      plan?.negativePrompt,
      "text, watermark, logo, low quality, blurry, distorted, scary, violent",
      "unrelated subject, missing main character, generic background, different main character design"
    ].filter(Boolean).join(", "),
    searchTerms: plan?.searchTerms?.length ? plan.searchTerms.slice(0, 4) : buildSearchTerms(scene)
  };
}

export function buildVisualProfile(theme: string, style: string) {
  const base = "vertical 9:16 social short, prompt-directed visual style, same main subjects, no text, no watermark, no logo";
  const lowerTheme = theme.toLocaleLowerCase("tr-TR");
  const styleIntent = buildPromptStyleIntent(theme, style);
  if (styleIntent.includes("futuristic")) {
    return `${base}, ${styleIntent}, high-tech environment, coherent futuristic production design, cinematic lighting, not childish, not toy-like`;
  }
  if (styleIntent.includes("product")) {
    return `${base}, ${styleIntent}, premium commercial product-video look, real materials, elegant tabletop or lifestyle lighting, not cartoon`;
  }
  if (styleIntent.includes("photorealistic")) {
    return `${base}, ${styleIntent}, natural camera perspective, believable real-world lighting, adult premium visual tone, not cartoon, not anime`;
  }
  if (lowerTheme.includes("türkiye") || lowerTheme.includes("gündem") || lowerTheme.includes("tarih") || lowerTheme.includes("spor")) {
    return `${base}, premium editorial documentary short, realistic Turkish urban atmosphere, tasteful navy and warm gray grade, cinematic archival mood, modern sports-documentary framing, believable people and places, not cartoon, not childish, not fantasy`;
  }
  if (style === "cartoon") {
    return `${base}, polished stylized animation only when the user explicitly asks for cartoon, cohesive character design, controlled colors, not childish, not toy-like`;
  }
  if (style === "storybook") {
    return `${base}, premium illustrated storybook frame, warm painterly texture, gentle lighting, cohesive hand-painted look, not photorealistic`;
  }
  if (style === "educational") {
    return `${base}, clean modern educational motion graphic style, simple premium shapes, consistent iconographic visual language, clear contrast`;
  }
  return `${base}, photorealistic cinematic frame, natural camera perspective, believable real-world lighting, polished documentary social video look, adult premium visual tone, not cartoon, not anime, not childlike 3D render, not toy-like`;
}

function buildPromptStyleIntent(theme: string, style: string) {
  const lower = `${theme} ${style}`.toLocaleLowerCase("tr-TR");
  if (/fütüristik|futuristic|cyberpunk|sci[- ]?fi|bilim kurgu|gelecek|neon|robot|mars|uzay|space|hologram/.test(lower)) {
    return "requested visual style: futuristic cinematic sci-fi, high-tech atmosphere, neon accents, advanced materials, dramatic contrast, realistic or premium concept-art look according to the prompt";
  }
  if (/gerçekçi|gercekci|realistic|photoreal|fotoğraf|fotograf|documentary|belgesel|ugc|street|sokak/.test(lower)) {
    return "requested visual style: photorealistic cinematic documentary, real camera lens, natural skin and material texture, believable environment";
  }
  if (/ürün|urun|product|reklam|commercial|tanıtım|tanitim|kalem|araba|car/.test(lower)) {
    return "requested visual style: premium commercial product video, realistic lifestyle scene, clean composition, real-world materials and reflections";
  }
  if (/çizgi film|cizgi film|cartoon|anime|storybook|masal|illustration|illustrated/.test(lower)) {
    return "requested visual style: stylized illustration or animation because the user explicitly requested it, cohesive and premium, not generic childish clipart";
  }
  return "requested visual style: follow the user's prompt literally; use cinematic realism by default and do not force cartoon or childish 3D";
}

function buildCoreSubjectLock(theme: string, scenes: string[]) {
  const source = `${theme} ${scenes.join(" ")}`.toLocaleLowerCase("tr-TR");
  const locks: string[] = [];
  const animalLocks: string[] = [];
  if (/\bkedi\b|cat/.test(source)) animalLocks.push("one curious cat");
  if (/\bköpek\b|\bkopek\b|dog/.test(source)) animalLocks.push("one loyal dog");
  if (animalLocks.length) locks.push(`main characters: ${animalLocks.join(" and ")}, same appearance in every scene`);
  if (/kano|kayak|canoe/.test(source)) locks.push("main prop: a small canoe clearly visible");
  if (/koy|sahil|deniz|ada|beach|bay|sea/.test(source)) locks.push("main location: calm sea, hidden bay, shoreline and warm sunlight");
  if (/mars|uzay|space|spaceship|roket|rocket|gezegen/.test(source)) locks.push("main world: futuristic Mars adventure, red planet landscape, spaceship or Mars base when relevant");
  if (/kalem|pen|ürün|urun|product/.test(source)) locks.push("main subject: the product must stay clearly visible and consistent");
  if (/futbol|spor|maç|mac|football|stadium/.test(source)) locks.push("main world: realistic sports documentary visuals, stadium or training atmosphere when relevant");
  if (/tarih|osmanlı|osmanli|cumhuriyet|history/.test(source)) locks.push("main world: realistic historical documentary atmosphere, archival texture when relevant");
  if (!locks.length) locks.push("main subject from the user's prompt must be clearly visible, not replaced by a generic background");
  return `Core subject lock: ${locks.join("; ")}. Never introduce unrelated subjects.`;
}

function translateVisualCue(scene: string) {
  const lower = scene.toLocaleLowerCase("tr-TR");
  const cues: string[] = [];
  if (/\bkedi\b/.test(lower)) cues.push("cat");
  if (/\bköpek\b|\bkopek\b/.test(lower)) cues.push("dog");
  if (/kano/.test(lower)) cues.push("canoe");
  if (/koy/.test(lower)) cues.push("hidden bay");
  if (/deniz|dalga|su/.test(lower)) cues.push("sea water");
  if (/martı|marti/.test(lower)) cues.push("seagulls");
  if (/güneş|gunes/.test(lower)) cues.push("warm sunlight");
  if (/mars/.test(lower)) cues.push("Mars red planet landscape");
  if (/uzay|roket|spaceship|space/.test(lower)) cues.push("futuristic spaceship");
  if (/fütüristik|futuristic|neon/.test(lower)) cues.push("futuristic sci-fi design");
  if (!cues.length) cues.push(scene);
  return cues.join(", ");
}

function buildSearchTerms(scene: string) {
  const lower = scene.toLocaleLowerCase("tr-TR");
  if (lower.includes("spor") || lower.includes("futbol") || lower.includes("maç")) return ["turkish football", "stadium crowd", "sports documentary"];
  if (lower.includes("tarih") || lower.includes("osmanlı") || lower.includes("cumhuriyet")) return ["turkish history", "archive documentary", "old city"];
  if (lower.includes("gündem") || lower.includes("türkiye") || lower.includes("şehir")) return ["turkey city", "istanbul street", "documentary"];
  if (lower.includes("deniz") || lower.includes("su")) return ["ocean light", "underwater", "blue cinematic"];
  if (lower.includes("şehir") || lower.includes("robot")) return ["futuristic city", "technology", "cinematic lights"];
  if (lower.includes("orman") || lower.includes("doğa")) return ["forest sunlight", "nature", "adventure"];
  return ["cinematic background", "dreamy lights", "storytelling"];
}

function defaultHashtags(language: LanguageCode, targetPlatform: string) {
  const common = targetPlatform === "shorts" ? ["#Shorts"] : targetPlatform === "reels" ? ["#Reels"] : ["#TikTok"];
  const localized: Record<LanguageCode, string[]> = {
    tr: ["#gündem", "#tarih", "#spor", "#keşfet"],
    en: ["#turkey", "#history", "#sports", "#story"],
    de: ["#tuerkei", "#geschichte", "#sport", "#story"],
    es: ["#turquia", "#historia", "#deporte", "#story"]
  };
  return [...common, ...localized[language]];
}

function fallbackLocalizedTitle(title: string, language: LanguageCode) {
  if (language === "en") return `${title} Story`;
  if (language === "de") return `${title} Geschichte`;
  if (language === "es") return `${title} Historia`;
  return title;
}

function parseGeneratedStory(text: string, sceneCount: number): GeneratedStory | null {
  try {
    const jsonText = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(jsonText) as { title?: unknown; story?: unknown; scenes?: unknown };
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes.map(normalizeGeneratedScene).filter(Boolean) : [];
    if (parsed.title && parsed.story && scenes.length >= 3) {
      return {
        title: String(parsed.title).slice(0, 90),
        story: limitVoiceoverLength(cleanNarrativeText(String(parsed.story))),
        scenes: scenes.slice(0, sceneCount).map((scene) => scene.slice(0, 96))
      };
    }
  } catch (error) {
    console.warn("Story JSON parse failed.", error);
  }
  return null;
}

function limitVoiceoverLength(value: string) {
  const cleaned = cleanNarrativeText(value);
  if (cleaned.length <= 250 && cleaned.split(/\s+/).length <= 42) return cleaned;
  const sentences = cleaned.match(/[^.!?]+[.!?]?/g) ?? [cleaned];
  let result = "";
  for (const sentence of sentences) {
    const next = `${result} ${sentence.trim()}`.trim();
    if (next.length > 250 || next.split(/\s+/).length > 42) break;
    result = next;
  }
  if (result) return result;
  return cleaned.split(/\s+/).slice(0, 42).join(" ").slice(0, 250).trim();
}

function fallbackStory(theme: string, style: string, ageGroup: string, sceneCount: number): GeneratedStory {
  const cleanTheme = theme.trim() || "Türkiye merak atlası";
  const shortTheme = cleanNarrativeText(cleanTheme).slice(0, 120);
  const baseScenes = [
    `Bunu çoğu kişi böyle düşünmüyor: ${shortTheme}`,
    `Önce kısa bağlam: konu basit görünüyor ama etkisi daha büyük.`,
    `Asıl detay, ilk bakışta fark edilmeyen küçük kararın içinde.`,
    `Kırılma anı burada: görünen tarafla arka plan aynı değil.`,
    `Bunu kaydet; çünkü kısa anlatımın özü burada.`
  ];
  const scenes = Array.from({ length: sceneCount }, (_, index) => baseScenes[index % baseScenes.length]);
  return {
    title: `${titleCase(cleanTheme)} Video Hikayesi`,
    story: scenes.join("\n\n"),
    scenes
  };
}

function normalizeGeneratedScene(value: unknown) {
  if (typeof value === "string") return cleanSceneText(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate = record.metin ?? record.text ?? record.subtitle ?? record.summary ?? record.scene ?? record.sahne;
    if (typeof candidate === "string") return cleanSceneText(candidate);
  }
  return "";
}

function cleanSceneText(value: string) {
  return cleanNarrativeText(value)
    .replace(/^(hook|bağlam|baglam|detay\s*\d*|kırılma|kirilma|sonuç|sonuc|cta)\s*(\([^)]*\))?\s*[:.-]\s*/i, "")
    .replace(/^\d+\s*[-.)]\s*/, "")
    .slice(0, 120);
}

function cleanNarrativeText(value: string) {
  return value
    .replace(/#[\p{L}\p{N}_-]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}
