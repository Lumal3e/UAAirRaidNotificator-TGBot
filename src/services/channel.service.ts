import { prisma } from "./prisma.js";
import type { Chat } from "grammy/types";

export const ChannelService = {
    async registerOrUpdate(chat: Chat) {
        const title = chat.type === "private"
            ? chat.first_name
            : chat.title;

        return prisma.channel.upsert({
            where: { id: BigInt(chat.id) },
            update: {
                isActive: true,
                title: title ?? null
            },
            create: {
                id: BigInt(chat.id),
                title: title ?? null,
                type: chat.type === "supergroup" ? "group" : chat.type,
                isActive: true
            }
        });
    },

    async setInactive(chatId: number) {
        return prisma.channel.updateMany({
            where: { id: BigInt(chatId) },
            data: { isActive: false }
        });
    },

    async subscribeToRegion(chatId: number, regionId: number) {
        return prisma.subscribe.create({
            data: {
                channelId: BigInt(chatId),
                regionId: regionId
            }
        });
    },

    async subscribeToAll(chatId: number) {
        const regions = await prisma.region.findMany({ select: { id: true } });
        if (regions.length === 0) {
            throw new Error("No regions available to subscribe to")
        };

        const subscriptionsData = regions.map(region => ({
            channelId: BigInt(chatId),
            regionId: region.id
        }));

        return prisma.$transaction([
            prisma.subscribe.deleteMany({
                where: { channelId: BigInt(chatId) }
            }),
            prisma.subscribe.createMany({
                data: subscriptionsData
            })
        ]);
    }
};
