import { env } from "./env.js";

export const redisConnection = {
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null
};
