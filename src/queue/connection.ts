import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
    throw new Error("REDIS_URL is not defined in environment variables");
}

export const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null
});