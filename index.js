import dotenv from "dotenv";
import BookService from "./services/bookService.js";
dotenv.config();
import express from "express";
import { Markup, Telegraf } from "telegraf";
import categoriesCommand from "./commands/categories.js";
import bookCommand from "./commands/books.js";
import downloadCommand from "./commands/downloadSingle.js";
import seriesCommand from "./commands/downloadMulti.js";
import BookCacheModel from "./models/bookCacheModel.js";
import connectDB from "./config/database.js";

if (!process.env.BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!');
//default to PORT 4040
const PORT = process.env.PORT || 0; // 0 = find any available port
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

app.use(express.json());

// Initialize database connection
const initializeDatabase = async () => {
  try {
    await connectDB();
    console.log("[DATABASE] Connected successfully");
  } catch (error) {
    console.error("[DATABASE] Connection failed:", error);
    process.exit(1);
  }
};

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
  // await bookService.debugDatasetStructure();

  if (callbackData?.startsWith("category_")) {
    console.log("[CALLBACK] Received:", ctx.callbackQuery?.data);
    await bookCommand(ctx, bookService);
  } else if (callbackData?.startsWith("book_")) {
    await downloadCommand(ctx, bookService);
  } else if (callbackData?.startsWith("sr_")) {
    await seriesCommand(ctx, bookService);
  } else if (callbackData?.startsWith("page_")) {
    // Handle pagination: page_2_تفسير
    const parts = callbackData.split("_");
    const page = parseInt(parts[1]);
    const category = parts.slice(2).join("_"); // Handle categories with underscores

    // Call bookCommand with pagination info
    await bookCommand(ctx, bookService, category, page);
  }
});

// Handle text messages for category selection
bot.on("text", async (ctx) => {
  const text = ctx.message.text;

  // Map display names to actual category names
  const categoryMap = {
    "[ تفسير ]": "تفسير",
    تفسير: "تفسير",
    "[ حديث ]": "حديث",
    حديث: "حديث",
    "[ سيرة ]": "سيرة",
    سيرة: "سيرة",
    "[ عقيدة ]": "عقيدة",
    عقيدة: "عقيدة",
    "[ فقه ]": "فقه",
    فقه: "فقه",
    "[ زهد و رقائق ]": "زهد و رقائق",
    "زهد و رقائق": "زهد و رقائق",
    "[ علوم أخرى ]": "علوم_أخرى",
    "علوم أخرى": "علوم_أخرى",
    علوم_أخرى: "علوم_أخرى",
    "[ قراءات ]": "قراءات",
    قراءات: "قراءات",
  };

  const categoryName = categoryMap[text];
  if (categoryName) {
    // Create a fake callback query context for bookCommand
    // ctx.callbackQuery = { data: `category_${categoryName}` };
    await bookCommand(ctx, bookService, categoryName);
  }
});

// Initialize database and start bot
async function startApplication() {
  await initializeDatabase();
  bot.launch();
}

startApplication();

//GET route, this is 
app.get("/api/health", async (req, res) => {
  try {
    // Test database connection
    const testQuery = await BookCacheModel.findOne().limit(1);
    res.json({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
      port: server.address()?.port,
      testQuery: testQuery ? "success" : "no_data",
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      database: "disconnected",
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});


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

// Start server with enhanced error handling
const server = app
  .listen(PORT, function () {
    const actualPort = server.address().port;
    console.log(`[SERVER] Running on http://localhost:${actualPort}`);
    console.log(`[BOT] Running in polling mode`);

    // Graceful shutdown: kills the processes gradually to avoid memory problems
    process.once("SIGINT", () => {
      console.log("[SHUTDOWN] Received SIGINT, shutting down gracefully...");
      bot.stop("SIGINT");
      server.close();
    });
    process.once("SIGTERM", () => {
      console.log("[SHUTDOWN] Received SIGTERM, shutting down gracefully...");
      bot.stop("SIGTERM");
      server.close();
    });
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[ERROR] Port ${PORT} is already in use.`);
      console.log(`[INFO] Try one of these solutions:`);
      console.log(`   1. Kill existing process: pkill -f "node.*index.js"`);
      console.log(`   2. Use a different port: PORT=4027 node index.js`);
      console.log(`   3. Let the system choose: Remove PORT from .env file`);
      process.exit(1);
    } else {
      console.error("[ERROR] Server error:", err);
      process.exit(1);
    }
  });
