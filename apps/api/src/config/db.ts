import mongoose from "mongoose";
import { env } from "./env.js";

// Express API ve BullMQ worker aynı MongoDB bağlantısını kullanır; böylece kayıtlar ve üretim adımları aynı veritabanında birleşir.
export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
}
