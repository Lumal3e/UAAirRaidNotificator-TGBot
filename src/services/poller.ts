import { Bot } from "grammy";
import axios from "axios";
import { prisma } from "./prisma.js"
interface ApiAlert {
    location_uid: string;
    alert_type: "air_raid" | "artillery_shelling" | "urban_fights" | "chemical" | "nuclear";
    started_at: string;
}

interface ApiResponse {
    alerts: ApiAlert[];
}

export class AlertPoller {
    private bot: Bot;
    private isRunning: boolean = false;
    private readonly apiUrl = `https://api.alerts.in.ua/v1/alerts/active.json`;
    private readonly token = process.env.API_TOKEN;
    constructor(bot: Bot) {
        this.bot = bot;
    }

    public start() {
        if (this.isRunning) {
            console.log("Alert poller already running");
            return;
        }
        this.isRunning = true;
        console.log("Alert poller started");
        this.runLoop();
    }

    private async runLoop() {
        while (this.isRunning) {
            try {
                await this.fetchAlerts();
            } catch (error) {
                console.error("Error fetching alerts:", error);
            }
            await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 seconds
        }
    }

    private async fetchAlerts(){
        if (!this.token) {
            throw new Error("API token is not defined");
        }
        const res = await axios.get<ApiResponse>(this.apiUrl, {
            headers: {
                Authorization: `Bearer ${this.token}`
            },
            timeout: 5000 // 5 seconds
        });

        const activeAlerts = res.data.alerts;
        await this.processDiff(activeAlerts);
    }

    private async processDiff(alerts: ApiAlert[]) {
        const activeApiAlerts = new Map<number, ApiAlert>();
        for (const alert of alerts) {
            activeApiAlerts.set(parseInt(alert.location_uid), alert);
        }
        const dbRegions = await prisma.region.findMany({
            include: { subscribes: true}
        });

        for (const region of dbRegions) {
            const apiAlert = activeApiAlerts.get(region.apiId);
            const isAlertActive = !!apiAlert;
            const wasAlertActive = region.isAlertActive;

            if (isAlertActive && !wasAlertActive) {
                // Alert started
                console.log(`Alert started for region ${region.name} at ${new Date().toISOString()}`);
                // Update DB
                await prisma.region.update({
                    where: { id: region.id },
                    data: { isAlertActive: true }
                });
                // Create notification
                const message = `Alert started in ${region.name}!\nType: ${apiAlert!.alert_type}\nStarted at: ${apiAlert!.started_at}`;
                await this.notifySubscribers(region.subscribes, message)
            }   
            else if (!isAlertActive && wasAlertActive) {
                // Alert ended
                console.log(`Alert ended for region ${region.name} at ${new Date().toISOString()}`);
                // Update DB
                await prisma.region.update({
                    where: { id: region.id },
                    data: { isAlertActive: false }
                });
                // Create notification
                const message = `Alert ended in ${region.name}\nEnded at: ${new Date().toISOString()}`
            }

        }
    }
    private async notifySubscribers(subscribers: any[], message: string) {
            if (!subscribers || subscribers.length === 0) {
                return;
            }
            console.log(`Notifying ${subscribers.length} subbscribers`);
            for (const sub of subscribers) {
                try {
                    await this.bot.api.sendMessage(String(sub.channelId), message);
                } catch (error) {
                    console.error(`Failed to send message to subscriber ${sub.channelId}`, error);
                }
            }
        }
}