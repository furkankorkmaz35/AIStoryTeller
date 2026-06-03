import { env } from "./env.js";

// BullMQ uses this Redis connection for every video pipeline job.
export const redisConnection = {
  host: env.redisHost,
  port: env.redisPort,
  maxRetriesPerRequest: null
};
