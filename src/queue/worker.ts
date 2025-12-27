import { Worker } from "bullmq";
import { connection } from "./connection.js";
import { Bot, GrammyError } from "grammy";
import { ChannelService } from "../services/channel.service.js";
import { notificationQueue } from "./producer.js";

interface NotificationData {
    channelId: number;
    message: string;
}

export const startWorker = (bot: Bot) => {
    const worker = new Worker<NotificationData>(notificationQueue.name, async job => {
        const { channelId, message } = job.data;

        try {
            await bot.api.sendMessage(channelId, message);
        } catch (error) {
            if (error instanceof GrammyError) {
                if (error.error_code === 403 || error.description.includes("blocked")) {
                    await ChannelService.setInactive(channelId);
                    console.log(`Bot was blocked or removed from chat ${channelId}. Setted as inactive`);
                    return;
                }
            }
            console.error(`Failed to send message to channel ${channelId}:`, error);
            throw error;
        }
    }, {
        connection,
        concurrency: 5,
        limiter: {
            max: 20,
            duration: 1000 // 1 second
        }
    });

    worker.on("failed", (job, err) => {
        console.error(`Job ${job?.id} failed sending notification to channel ${job?.data.channelId}: ${err.message}`);
    });

    return worker;
}