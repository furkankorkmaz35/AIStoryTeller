import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://localhost:27017/ai-video-generator",
  redisHost: process.env.REDIS_HOST ?? "localhost",
  redisPort: Number(process.env.REDIS_PORT ?? 6380),
  publicApiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://localhost:4000",
  aiProvider: process.env.AI_PROVIDER ?? "fallback",
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-1.5-flash",
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqModel: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant",
  ttsProvider: process.env.TTS_PROVIDER ?? "system",
  imageProvider: process.env.IMAGE_PROVIDER ?? "fallback"
};
