import { connection } from "./connection.js";
import { Queue } from "bullmq";

export const notificationQueue = new Queue("notificationQueue", {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: "exponential",
            delay: 1000, // 1 seconds
        },
        removeOnComplete: true,
        removeOnFail: 100
    }
});