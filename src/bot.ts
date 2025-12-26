import { Bot } from "grammy";
import { AlertPoller } from "./services/poller.js";
import { ChannelService } from "./services/channel.service.js";
import subscribtionHandler from "./handlers/subscription.js";

const bot = new Bot(process.env.BOT_TOKEN!);

// deleting bot or updating status
bot.on("my_chat_member", async (ctx) => {
  const newStatus = ctx.myChatMember.new_chat_member.status;
  const chatId = ctx.chat.id;

  if (["kicked", "left"].includes(newStatus)) { 
    await ChannelService.setInactive(chatId);
    console.log(`Bot was removed from chat ${ctx.chat.id} ${ctx.chat.title}`);
  }
  else if (["member", "administrator", "creator"].includes(newStatus)) {
    await ChannelService.registerOrUpdate(ctx.chat);
    console.log(`Bot was added to chat ${ctx.chat.id} ${ctx.chat.title}`);
  }
});

// start command
bot.command("start", async (ctx) => {
  await ChannelService.registerOrUpdate(ctx.chat);
  await ctx.reply("Welcome, you have been added to the database");
});

// subscription commands
bot.use(subscribtionHandler);

// start bot and pooler
const poller = new AlertPoller(bot);

bot.start({
  onStart: (botInfo) => {
    console.log(`Bot started as @${botInfo.username}`);
    poller.start();
  }
});

// error handler
bot.catch((error) => {
  console.error("Global error:", error);
});