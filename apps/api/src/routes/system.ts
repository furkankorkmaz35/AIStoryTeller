import { Router } from "express";
import mongoose from "mongoose";
import { videoQueue } from "../queues/videoQueue.js";
import { env } from "../config/env.js";

const router = Router();

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
        tts: env.ttsProvider,
        video: "remotion"
      }
    });
  } catch (error) {
    next(error);
  }
});

export { router as systemRouter };
