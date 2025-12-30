import { Bot } from "grammy";
import axios from "axios";
import { prisma } from "./prisma.js"
import { notificationQueue } from "../queue/producer.js";
import { formatTime, getReadableAlertType, formatMessage } from "./utils.js";

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
            include: { subscribes: {
                include: { channel: true }
            }}
        });

        for (const region of dbRegions) {
            const apiAlert = activeApiAlerts.get(region.apiId);
            const isAlertActive = !!apiAlert;
            const wasAlertActive = region.isAlertActive;
            const baseVars = {
                region: region.name,
                type: getReadableAlertType(apiAlert?.alert_type)
            };
            if (isAlertActive && !wasAlertActive) {
                // Alert started
                console.log(`Alert started for region ${region.name} at ${formatTime(apiAlert!.started_at)}`);
                // Update DB
                await prisma.region.update({
                    where: { id: region.id },
                    data: { isAlertActive: true }
                });
                // add time variable
                const templateVars = {
                    ...baseVars,
                    time: formatTime(apiAlert!.started_at)
                };
                // Create notification
                await this.notifySubscribers(region.subscribes, "start", templateVars);
            }   
            else if (!isAlertActive && wasAlertActive) {
                // Alert ended
                console.log(`Alert ended for region ${region.name} at ${formatTime()}`);
                // Update DB
                await prisma.region.update({
                    where: { id: region.id },
                    data: { isAlertActive: false }
                });
                // add time variable
                const templateVars = {
                    ...baseVars,
                    time: formatTime()
                };
                // Create notification
                await this.notifySubscribers(region.subscribes, "end", templateVars);
            }

        }
    }

    private async notifySubscribers(subscribers: any[], 
        eventType: "start" | "end", 
        vars: { region: string, time: string, type: string }) {
            if (!subscribers || subscribers.length === 0) {
                return;
            }
            const defaulStartTemplate = "🔴 <b>{type}!</b>\nОбласть: {region}!\nЧас: {time}";
            const defaultEndTemplate = "🟢 <b>Відбій тривоги!</b>\nОбласть: {region}!\nЧас: {time}";
            for (const sub of subscribers) {
                if (!sub.channel.isActive) {
                    continue;
                }
                try {
                    let template = "";
                    if (eventType === "start") {
                        template = sub.customAlert ?? defaulStartTemplate;
                    }
                    else {
                        template = sub.customCalm ?? defaultEndTemplate;
                    }
                    const message = formatMessage(template, vars);
                    await notificationQueue.add("sendNotification", {
                        channelId: String(sub.channelId),
                        message: message
                    });
                } catch (error) {
                    console.error(`Failed to queue notification for channel ${sub.channelId}:`, error);
                }
            }
        }
}