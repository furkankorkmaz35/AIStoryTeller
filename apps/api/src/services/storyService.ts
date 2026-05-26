import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env.js";

export type GeneratedStory = {
  title: string;
  story: string;
  scenes: string[];
};

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

function buildStoryPrompt(theme: string, style: string, ageGroup: string, sceneCount: number) {
  return [
    "Turkce, cocuklara uygun bir AI video hikayesi uret.",
    `Tema: ${theme}`,
    `Gorsel stil: ${style}`,
    `Yas grubu: ${ageGroup}`,
    `Tam olarak ${sceneCount} sahne yaz.`,
    "Sadece gecerli JSON don. Markdown kullanma.",
    "JSON semasi: {\"title\":\"...\",\"story\":\"...\",\"scenes\":[\"...\", \"...\", \"...\"]}.",
    "scenes sadece metin dizisi olsun ve sahne sayisi istenen sayiya esit olsun."
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
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Sen cocuklara uygun, kisa ve video sahnelerine bolunebilir Turkce hikayeler yazan bir yaratici asistansin."
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

function parseGeneratedStory(text: string, sceneCount: number): GeneratedStory | null {
  try {
    const jsonText = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(jsonText) as GeneratedStory;
    if (parsed.title && parsed.story && parsed.scenes?.length >= 3) {
      return {
        title: parsed.title,
        story: parsed.story,
        scenes: parsed.scenes.slice(0, sceneCount)
      };
    }
  } catch (error) {
    console.warn("Story JSON parse failed.", error);
  }
  return null;
}

function fallbackStory(theme: string, style: string, ageGroup: string, sceneCount: number): GeneratedStory {
  const cleanTheme = theme.trim() || "cesur bir robot";
  const baseScenes = [
    `${cleanTheme} sabah uyandiginda sehri kaplayan lacivert isiklarin arasinda gizemli bir harita buldu.`,
    `Harita onu, korkularini kucuk adimlarla asabilecegi parlak bir atolyeye goturdu.`,
    `Atolyede tanistigi arkadaslariyla birlikte kaybolan hayalleri toplayan sicak bir makine tasarladi.`,
    `Makine calistiginda herkes kendi hikayesini daha cesur ve daha nazik anlatmayi ogrendi.`,
    `${cleanTheme} artik her gece yeni bir macerayi paylasarak sehrin isiklarini yeniden yakiyordu.`
  ];
  const scenes = Array.from({ length: sceneCount }, (_, index) => baseScenes[index % baseScenes.length]);
  return {
    title: `${titleCase(cleanTheme)} Video Hikayesi`,
    story: scenes.join("\n\n"),
    scenes
  };
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0]?.toLocaleUpperCase("tr-TR") + word.slice(1))
    .join(" ");
}
