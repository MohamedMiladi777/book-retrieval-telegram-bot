import express from "express";
import mongoose from "mongoose";
import Book from "./models/bookModel.js";
import connectDB from "./config/database.js";
import dotenv from "dotenv";
dotenv.config();
import { Telegraf } from "telegraf";

const PORT = process.env.PORT || 4040;
const app = express();
const bot = new Telegraf(process.env.TOKEN);

app.use(express.json());

//Connect to the database
connectDB();
bot.start((ctx) => {
  return ctx.reply(`Hello ${ctx.update.message.from.first_name}!`);
});
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
});
