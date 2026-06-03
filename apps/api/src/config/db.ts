import mongoose from "mongoose";
import { env } from "./env.js";

// Shared MongoDB connection used by both Express API and BullMQ worker.
export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
}
