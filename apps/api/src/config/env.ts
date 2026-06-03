import dotenv from "dotenv";

dotenv.config();

// Centralized environment values keep provider keys and model choices out of route/service code.
export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/ai-video-generator",
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: Number(process.env.REDIS_PORT ?? 6380),
  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://localhost:4000",
  aiProvider: process.env.AI_PROVIDER ?? "fallback",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
  ttsProvider: "elevenlabs",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "01p4omegjS2n3rSDCM5u",
  elevenLabsFallbackVoiceId: process.env.ELEVENLABS_FALLBACK_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb",
  elevenLabsModel: process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2",
  elevenLabsMaxCharacters: Number(process.env.ELEVENLABS_MAX_CHARACTERS ?? 4500),
  imageProvider: process.env.IMAGE_PROVIDER ?? "auto",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? "",
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN ?? "",
  cloudflareImageModel: process.env.CLOUDFLARE_IMAGE_MODEL ?? "@cf/stabilityai/stable-diffusion-xl-base-1.0",
  pollinationsApiKey: process.env.POLLINATIONS_API_KEY ?? "",
  pollinationsImageModel: process.env.POLLINATIONS_IMAGE_MODEL ?? "flux",
  huggingFaceToken: process.env.HF_TOKEN ?? process.env.HUGGINGFACE_API_KEY ?? "",
  huggingFaceImageModel: process.env.HF_IMAGE_MODEL ?? "stabilityai/stable-diffusion-xl-base-1.0",
  huggingFaceInferenceBaseUrl: process.env.HF_INFERENCE_BASE_URL ?? "https://api-inference.huggingface.co/models",
  huggingFaceImageSteps: Number(process.env.HF_IMAGE_STEPS ?? 25),
  huggingFaceGuidanceScale: Number(process.env.HF_GUIDANCE_SCALE ?? 7.5),
  pexelsApiKey: process.env.PEXELS_API_KEY ?? "",
  pixabayApiKey: process.env.PIXABAY_API_KEY ?? ""
};
