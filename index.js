require("dotenv").config();
const {Bot} = require("grammy");

const bot = new Bot(process.env.BOT_API);

bot.command("start", async (ctx) => {
    await ctx.reply("Welcome!")
});

bot.start();
