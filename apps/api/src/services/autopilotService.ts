import { env } from "../config/env.js";
import type { LanguageCode } from "./storyService.js";

export type AccountStrategy = {
  name: string;
  platform: "instagram" | "tiktok" | "youtube";
  platforms?: Array<"instagram" | "tiktok" | "youtube">;
  category?: string;
  concept: string;
  audience: string;
  tone: string;
  language: LanguageCode;
  forbiddenTopics: string[];
  postingDays?: string[];
  postingHours: string[];
};

export type GeneratedIdea = {
  source: string;
  trend: string;
  title: string;
  hook: string;
  theme: string;
  angle: string;
  score: number;
  scoreReason: string;
  captionSeed: string;
  hashtags: string[];
};

const fallbackTrends = [
  "Türkiye gündeminde herkesin konuştuğu konunun arka planı",
  "tarihte bugün Türkiye'de unutulan bir kırılma anı",
  "Türk futbolunda maçtan daha büyük hale gelen hikaye",
  "bir şehrin kaderini değiştiren küçük karar",
  "spor tarihinde son dakikada değişen büyük anlatı",
  "Türkiye'de sosyal medyada tartışma yaratan ama yanlış anlaşılan konu",
  "Osmanlı'dan Cumhuriyet'e uzanan şaşırtıcı bağlantı",
  "haftanın en ilginç gündem sorusu"
];

export async function generateAutopilotIdeas(strategy: AccountStrategy, count = 5): Promise<GeneratedIdea[]> {
  const trends = await getTrendCandidates(strategy);
  const groqIdeas = await tryGroqIdeas(strategy, trends, count);
  if (groqIdeas.length) return groqIdeas.slice(0, count);
  return fallbackIdeas(strategy, trends, count);
}

const weekDayIndexes: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
};

export function nextPostingDate(postingHours: string[], offset = 0, postingDays: string[] = ["mon", "wed", "fri"]) {
  const now = new Date();
  const sortedHours = [...new Set(postingHours.length ? postingHours : ["20:30"])].sort();
  const allowedDays = new Set((postingDays.length ? postingDays : ["mon", "wed", "fri"]).map((day) => weekDayIndexes[day]).filter((day) => day !== undefined));
  const candidates: Date[] = [];
  for (let dayOffset = 0; dayOffset < 35; dayOffset += 1) {
    for (const hour of sortedHours) {
      const [hours, minutes] = hour.split(":").map(Number);
      const candidate = new Date(now);
      candidate.setDate(now.getDate() + dayOffset);
      candidate.setHours(hours || 20, minutes || 30, 0, 0);
      if (candidate <= now) continue;
      if (allowedDays.size && !allowedDays.has(candidate.getDay())) continue;
      candidates.push(candidate);
    }
  }
  return candidates[offset] ?? candidates[0] ?? new Date(now.getTime() + 60 * 60 * 1000);
}

async function getTrendCandidates(strategy: AccountStrategy) {
  const conceptTerms = strategy.concept
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  return [strategy.category, ...contentFormats(strategy), ...conceptTerms, ...fallbackTrends]
    .filter((item): item is string => Boolean(item))
    .slice(0, 12);
}

async function tryGroqIdeas(strategy: AccountStrategy, trends: string[], count: number): Promise<GeneratedIdea[]> {
  if (!env.groqApiKey || !["auto", "groq"].includes(env.aiProvider)) return [];
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.groqModel,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Sen sosyal medya içerik stratejisti ve kısa video editörüsün. Trendleri konsepte göre filtreler, güvenli ve üretilebilir video fikirleri üretirsin."
          },
          {
            role: "user",
            content: [
              "Sadece geçerli JSON dön.",
              "Şema: {\"ideas\":[{\"source\":\"trend|strategy\",\"trend\":\"...\",\"title\":\"...\",\"hook\":\"...\",\"theme\":\"...\",\"angle\":\"...\",\"score\":80,\"scoreReason\":\"...\",\"captionSeed\":\"...\",\"hashtags\":[\"#...\"]}]}",
              `Fikir sayısı: ${count}`,
              `Ana platform: ${strategy.platform}`,
              `Platform paketi: ${(strategy.platforms?.length ? strategy.platforms : [strategy.platform]).join(", ")}`,
              `Kategori: ${strategy.category || "AI ile gerçek hayat"}`,
              `Konsept: ${strategy.concept}`,
              `Hedef kitle: ${strategy.audience}`,
              `Ton: ${strategy.tone}`,
              `Dil: ${strategy.language}`,
              `Yayın ritmi: ${(strategy.postingDays?.length ? strategy.postingDays : ["mon", "wed", "fri"]).join(", ")} günleri, ${strategy.postingHours.join(", ")} saatleri`,
              `Yasaklı konular: ${strategy.forbiddenTopics.join(", ") || "yok"}`,
              `Trend adayları: ${trends.join(", ")}`,
              "Her fikir 9:16 kısa video için 4-5 sahnede üretilebilir olsun.",
              "Hook ilk 2 saniyede izleyiciye 'bunu bilmiyordum' dedirtsin.",
              "Fikir haber bülteni gibi kuru olmasın; mikro hikaye, ters köşe veya güçlü soru taşısın.",
              "Gündem konularında iddia uydurma; kesin olmayan şeyi 'neden konuşuluyor?' veya 'arka planı ne?' gibi güvenli çerçevele.",
              "Türkiye, tarih ve spor eksenini koru; çocuk masalı, sahne numarası, AI kanalı dili veya uzun altyazı dili kullanma.",
              "captionSeed icinde 1 kısa CTA ve thumbnail metni önerisi de olsun."
            ].join("\n")
          }
        ]
      })
    });
    if (!response.ok) throw new Error(`Groq ideas ${response.status}: ${await response.text()}`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { ideas?: GeneratedIdea[] };
    return (parsed.ideas ?? []).map(normalizeIdea).filter((idea) => idea.score >= 45);
  } catch (error) {
    console.warn("Groq autopilot ideas failed.", error);
    return [];
  }
}

function fallbackIdeas(strategy: AccountStrategy, trends: string[], count: number): GeneratedIdea[] {
  return trends.slice(0, count).map((trend, index) =>
    normalizeIdea({
      source: index < 2 ? "strategy" : "trend",
      trend,
      title: `${trend} için 45 saniyelik dikkat çekici hikaye`,
      hook: `Bu olayın arkasındaki küçük detay çoğu kişinin gözünden kaçıyor: ${trend}`,
      theme: `${strategy.category || "Türkiye merak atlası"} kategorisinde, ${strategy.concept}: ${trend} üzerine kısa sosyal medya videosu`,
      angle: `${strategy.audience} için hızlı, güvenilir, merak uyandıran ve paylaşılabilir anlatım`,
      score: Math.max(62, 86 - index * 5),
      scoreReason: "Konseptle uyumlu fallback fikir; API anahtarı olmadan üretildi.",
      captionSeed: `${trend} hakkında kısa bir video. Kaydet, sonra tekrar izle. Thumbnail: Bunu kimse böyle anlatmadı.`,
      hashtags: defaultHashtags(strategy.platform, strategy.language)
    })
  );
}

function normalizeIdea(idea: Partial<GeneratedIdea>): GeneratedIdea {
  const normalized = {
    source: idea.source || "strategy",
    trend: idea.trend || "",
    title: idea.title || "Yeni sosyal medya fikri",
    hook: idea.hook || "İlk 2 saniyede merak uyandıran güçlü soru",
    theme: idea.theme || idea.title || "Kısa sosyal medya videosu",
    angle: idea.angle || "Konsepte uygun sade anlatım",
    score: Math.min(100, Math.max(0, Number(idea.score ?? 70))),
    scoreReason: idea.scoreReason || "Konsept uyumu ve üretilebilirlik dengesi.",
    captionSeed: idea.captionSeed || idea.title || "",
    hashtags: idea.hashtags?.length ? idea.hashtags.slice(0, 8) : ["#gündem", "#tarih", "#spor", "#keşfet"]
  };
  const quality = scoreIdeaQuality(normalized);
  return {
    ...normalized,
    score: Math.min(100, Math.max(0, Math.round((normalized.score + quality.score) / 2))),
    scoreReason: `${normalized.scoreReason} Kalite kontrol: ${quality.reason}`
  };
}

function defaultHashtags(platform: string, language: LanguageCode) {
  const platformTag = platform === "youtube" ? "#Shorts" : platform === "tiktok" ? "#TikTok" : "#Reels";
  const languageTags: Record<LanguageCode, string[]> = {
    tr: ["#gündem", "#tarih", "#spor", "#keşfet"],
    en: ["#turkey", "#history", "#sports", "#shorts"],
    de: ["#tuerkei", "#geschichte", "#sport", "#shorts"],
    es: ["#turquia", "#historia", "#deporte", "#shorts"]
  };
  return [platformTag, ...languageTags[language]];
}

function contentFormats(strategy: AccountStrategy) {
  const dayFormats: Record<string, string> = {
    mon: "Pazartesi formatı: haftaya damga vuran Türkiye gündemi sorusu",
    tue: "Salı formatı: şehir, ekonomi veya toplum gündeminden kısa arka plan",
    wed: "Çarşamba formatı: tarihte bugün veya unutulan tarih bağlantısı",
    thu: "Perşembe formatı: sosyal medyada yanlış anlaşılan konuyu sadeleştirme",
    fri: "Cuma formatı: spor haftasının en dikkat çekici hikayesi",
    sat: "Cumartesi formatı: liste, karşılaştırma veya mini belgesel",
    sun: "Pazar formatı: haftanın özeti ve yeni hafta sorusu"
  };
  return (strategy.postingDays?.length ? strategy.postingDays : ["mon", "wed", "fri"]).map((day) => dayFormats[day]).filter(Boolean);
}

function scoreIdeaQuality(idea: GeneratedIdea) {
  const text = `${idea.title} ${idea.hook} ${idea.theme} ${idea.angle}`.toLocaleLowerCase("tr-TR");
  let score = 72;
  const reasons: string[] = [];
  if (/(türkiye|gündem|tarih|spor|futbol|cumhuriyet|osmanlı)/.test(text)) {
    score += 10;
    reasons.push("kategoriyle uyumlu");
  }
  if (/(asıl|kimse|neden|arka plan|kırılma|son dakika|unutulan|şaşırtıcı)/.test(text)) {
    score += 8;
    reasons.push("merak vurgusu var");
  }
  if (idea.hook.length > 135) {
    score -= 10;
    reasons.push("hook uzun");
  }
  if (/(sahne\s*\d+|yapay zeka kanalı|masal|çocuk)/i.test(text)) {
    score -= 18;
    reasons.push("istenmeyen dil riski");
  }
  if (idea.captionSeed.length < 24) {
    score -= 5;
    reasons.push("caption tohumu zayıf");
  }
  return { score, reason: reasons.length ? reasons.join(", ") : "yayına uygun temel format" };
}
