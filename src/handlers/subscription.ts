import { Composer } from "grammy";
import { ChannelService } from "../services/channel.service.js";

const composer = new Composer();

composer.command("sub", async (ctx) => {
    const regionId = parseInt(ctx.match as string);
    if (!regionId || isNaN(regionId)) {
        return ctx.reply("Missing or invalid region ID. Example: /sub 31");
    }

    try {
        await ChannelService.registerOrUpdate(ctx.chat);
        await ChannelService.subscribeToRegion(ctx.chat.id, regionId);

        await ctx.reply(`Successfully subscribed to region ID: ${regionId}`);
        console.log(`New subscription: Chat ${ctx.chat.id} -> Region ${regionId}`);
    } catch (error: any) {
        if (error.code === "P2002") {
            return ctx.reply("Already subscribed to this region");
        }
        console.error(error);
        await ctx.reply("Subcription error");
    }
});

composer.command("sub_all", async (ctx) => {
    try {
        await ChannelService.registerOrUpdate(ctx.chat);
        await ChannelService.subscribeToAll(ctx.chat.id);

        await ctx.reply("Successfully subscribed to all regions");
    } catch (error) {
        console.error(error);
        await ctx.reply("Subscription error");
    }
});

export default composer;
