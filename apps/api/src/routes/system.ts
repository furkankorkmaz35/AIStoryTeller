import { Router } from "express";
import mongoose from "mongoose";
import { videoQueue } from "../queues/videoQueue.js";
import { env } from "../config/env.js";

const router = Router();

// Frontend'in üst şeritte gösterdiği sağlık bilgileri: veritabanı, kuyruk sayıları ve aktif provider ayarları.
router.get("/status", async (_request, response, next) => {
  try {
    const counts = await videoQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    response.json({
      ok: mongoose.connection.readyState === 1,
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      queue: counts,
      providers: {
        ai: env.aiProvider,
        image: env.imageProvider,
        voice: env.ttsProvider,
        cloudflare: Boolean(env.cloudflareAccountId && env.cloudflareApiToken),
        pollinations: Boolean(env.pollinationsApiKey),
        huggingface: Boolean(env.huggingFaceToken),
        stock: Boolean(env.pexelsApiKey || env.pixabayApiKey),
        elevenlabs: Boolean(env.elevenLabsApiKey),
        video: "remotion"
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as systemRouter };
