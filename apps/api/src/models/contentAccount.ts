import { Schema, model } from "mongoose";

const contentAccountSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    platform: { type: String, enum: ["instagram", "tiktok", "youtube"], default: "instagram" },
    platforms: { type: [String], enum: ["instagram", "tiktok", "youtube"], default: ["instagram", "tiktok", "youtube"] },
    category: { type: String, default: "Türkiye merak atlası", trim: true },
    concept: { type: String, required: true, trim: true },
    audience: { type: String, default: "Türkiye gündemini, tarihi ve sporu sıkıcı olmayan kısa videolarla takip etmek isteyen izleyici" },
    tone: { type: String, default: "merak uyandıran, hızlı, güvenilir, şehirli ve gösterişsiz" },
    language: { type: String, enum: ["tr", "en", "de", "es"], default: "tr" },
    forbiddenTopics: { type: [String], default: [] },
    dailyPostTarget: { type: Number, min: 1, max: 6, default: 1 },
    postingDays: { type: [String], default: ["mon", "wed", "fri"] },
    postingHours: { type: [String], default: ["20:30"] },
    autopilotMode: { type: String, enum: ["manual", "assistant", "autopilot-safe", "autopilot"], default: "autopilot-safe" },
    status: { type: String, enum: ["active", "paused"], default: "active" }
  },
  { timestamps: true }
);

export const ContentAccountModel = model("ContentAccount", contentAccountSchema);
