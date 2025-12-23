import { Bot } from "grammy";
import { prisma } from "./services/prisma.js";
import { AlertPoller } from "./services/poller.js";

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("start", async (ctx) => {
  const chatId = ctx.chat.id;
  const type = ctx.chat.type;
  
  const title = ctx.chat.type === "private" 
    ? ctx.from?.first_name 
    : ctx.chat.title;

  try {
    await prisma.channel.upsert({
      where: { id: BigInt(chatId) },
      update: { 
          isActive: true,
          title: title ?? null
      },
      create: {
        id: BigInt(chatId),
        title: title ?? null,
        type: type === "supergroup" ? "group" : type,
        isActive: true
      }
    });

    await ctx.reply("Welcome, you have been added to the database");
  } catch (error) {
    console.error("DB error:", error);
    await ctx.reply("Something went wrong with DB.");
  }
});
bot.hears("52", (ctx) => ctx.reply("Scryptonite?"));
bot.on("message", (ctx) => ctx.reply("Message received!"));


bot.command("sub", async (ctx) => {
  const chatId = ctx.chat.id;

  const regionId = parseInt(ctx.match as string);

  if (!regionId || isNaN(regionId)) {
    return ctx.reply("Missing or invalid region ID. Example: /sub 31");
  }

  try {
    const title = ctx.chat.type === "private" ? ctx.from?.first_name : ctx.chat.title;
    
    await prisma.channel.upsert({
      where: { id: BigInt(chatId) },
      update: { isActive: true },
      create: {
        id: BigInt(chatId),
        title: title ?? "Unknown",
        type: ctx.chat.type === "supergroup" ? "group" : ctx.chat.type,
        isActive: true
      }
    });

    // Subcribe
    await prisma.subscribe.create({
      data: {
        channelId: BigInt(chatId),
        regionId: regionId
      }
    });

    await ctx.reply(`Successfully subscribed to region ID: ${regionId}`);
    console.log(`New subscription: Chat ${chatId} -> Region ${regionId}`);

  } catch (error: any) {
    if (error.code === 'P2002') {
        return ctx.reply("Already subscribed to this region");
    }
    console.error(error);
    await ctx.reply("Subcription error");
  }
});

bot.command("sub_all", async (ctx) => {
  const chatId = ctx.chat.id;

  try {
    const title = ctx.chat.type === "private" ? ctx.from?.first_name : ctx.chat.title;
    
    await prisma.channel.upsert({
      where: { id: BigInt(chatId) },
      update: { isActive: true },
      create: {
        id: BigInt(chatId),
        title: title ?? "Unknown",
        type: ctx.chat.type === "supergroup" ? "group" : ctx.chat.type,
        isActive: true
      }
    });

    const allRegions = await prisma.region.findMany({
      select: { id: true }
    });

    if (allRegions.length === 0) {
      return ctx.reply("⚠️ У базі немає регіонів. Спочатку запустіть сідінг!");
    }

    const subscriptionsData = allRegions.map((region) => ({
      channelId: BigInt(chatId),
      regionId: region.id,
    }));

    await prisma.$transaction([
      // delete old subscription
      prisma.subscribe.deleteMany({
        where: { channelId: BigInt(chatId) }
      }),
      // create new subscriptions
      prisma.subscribe.createMany({
        data: subscriptionsData
      })
    ]);

    await ctx.reply(`Succesfully subscribed to all ${allRegions.length} regions`);
    console.log(`Chat ${chatId} subscribed to ALL regions.`);

  } catch (error) {
    console.error("Subscribe all error:", error);
    await ctx.reply("Subscription error.");
  }
});

const poller = new AlertPoller(bot);
bot.start({
  onStart: (botInfo) => {
    console.log(`Bot started as @${botInfo.username}`);
    poller.start();
  }
});