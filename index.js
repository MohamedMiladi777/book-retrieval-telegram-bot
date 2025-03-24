import express from "express";
import mongoose from "mongoose";
import Book from "./models/bookModel.js";
import connectDB from "./config/database.js";
import dotenv from "dotenv";
dotenv.config();
import { Markup, Telegraf } from "telegraf";
import categoriesCommand from "./commands/categories.js";

// assert and refuse to start bot if token or webhookDomain is not passed
if (!process.env.BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!');
//default to PORT 4040
const PORT = process.env.PORT || 4040;
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

app.use(express.json());

//Connect to the database
connectDB();

bot.help((ctx) => ctx.reply("Help message"));
bot.command("categories", categoriesCommand);
bot.launch();

//GET route
app.get("/api/book", async (req, res) => {
  try {
    const book = await Book.find().sort({ createdAt: -1 });
    res.json(book);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
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

// Start server
app.listen(PORT, function (err) {
  console.log(`Server running on http://localhost:${PORT}`);

  // Graceful shutdown: kills the processes gradually to avoid memory problems
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
});
