import { env } from "./env.js";

// BullMQ, video üretim kuyruğundaki tüm işleri bu Redis bağlantısı üzerinden sıraya alır ve takip eder.
export const redisConnection = {
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null
};
