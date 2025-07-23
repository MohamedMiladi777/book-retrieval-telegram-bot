import dotenv from "dotenv";
import BookService from "./services/bookService.js";
dotenv.config();
import express from "express";
import { Markup, Telegraf } from "telegraf";
import categoriesCommand from "./commands/categories.js";
import bookCommand from "./commands/books.js";
import downloadCommand from "./commands/downloadSingle.js";
import seriesCommand from "./commands/downloadMulti.js";

if (!process.env.BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!');
//default to PORT 4040
const PORT = process.env.PORT || 0; // 0 = find any available port
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

app.use(express.json());
const bookService = new BookService();
bot.help((ctx) => ctx.reply("Help message"));
bot.start((ctx) =>
  ctx.reply(
    "السلام عليكم و رحمة الله و بركاته \n /categories لاستخدام البوت اكتب  \n Welcome! Use /categories to browse books."
  )
);

bot.command("categories", (ctx) => categoriesCommand(ctx, bookService));
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery?.data;
  await bookService.debugDatasetStructure();
  if (callbackData?.startsWith("category_")) {
    await bookCommand(ctx, bookService);
  } else if (callbackData?.startsWith("book_")) {
    await downloadCommand(ctx, bookService);
  }
  else if (callbackData?.startsWith("sr_")) {
    await seriesCommand(ctx, bookService);
  }
  // } else if (callbackData?.startsWith("series_")) {
  //   const seriesId = callbackData.replace("series_", "");
  //   const seriesBooks = await Book.find({ seriesId }).sort({ title: 1 });
  //   if (seriesBooks.length === 0) {
  //     return ctx.reply("No volumes found for this series.");
  //   }
  //   const keyboard = seriesBooks.map((book) => [
  //     Markup.button.callback(`📖 ${book.title}`, `book_${book._id.toString()}`),
  //   ]);
  //   await ctx.reply(
  //     "Select a volume:",
  //     Markup.inlineKeyboard(keyboard, { columns: 1 })
  //   );
  // }
});

bot.launch();

//GET route
// app.get("/api/book", async (req, res) => {
//   try {
//     const book = await Book.find().sort({ createdAt: -1 });
//     res.json(book);
//   } catch (err) {
//     console.error(err.message);
//     res.status(500).send("Server Error");
//   }
// });

//POST route
app.post("/api/book", async (req, res) => {
  try {
    const book = new Book(req.body);
    await book.save();
    res.json(book);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server error");
  }
});

// Start server
const server = app.listen(PORT, function () {
  const actualPort = server.address().port;
  console.log(`Server running on http://localhost:${actualPort}`);
  console.log(`Bot is running in polling mode`);
  // Graceful shutdown: kills the processes gradually to avoid memory problems
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
});
