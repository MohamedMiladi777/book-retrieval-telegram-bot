import dotenv from "dotenv";
dotenv.config();
import express from "express";
import Book from "./models/bookModel.js";
import connectDB from "./config/database.js";
import fs from "fs";
import { Markup, Telegraf } from "telegraf";
import categoriesCommand from "./commands/categories.js";
import bookCommand from "./commands/books.js";
import downloadCommand from "./commands/download.js";
import { uploadAndSaveBook } from "./utils/s3-utils.js";
import { downloadFile } from "./utils/file-utils.js";
// assert and refuse to start bot if token or webhookDomain is not passed
console.log("AWS Region:", process.env.AWS_REGION);

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
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery?.data;
  if (callbackData?.startsWith("category_")) {
    await bookCommand(ctx);
  } else if (callbackData?.startsWith("book_")) {
    await downloadCommand(ctx);
  }
});

// Handle the /addbook command
bot.on("document", async (ctx) => {
  const caption = ctx.message?.caption || "";

  if (!caption.startsWith("/addbook")) return;
  console.log("Received /addbook command");
  console.log("Received message:", ctx.message);
  try {
    const fileId = ctx.message.document.file_id;
    const fileName = ctx.message.document.file_name || "uploadedBook.pdf";
    console.log("File ID:", fileId);
    console.log("File Name:", fileName);
    const fileLink = await ctx.telegram.getFileLink(fileId);
    console.log("Fetched file link:", fileLink.href);
    const localPath = `./uploads/${fileName}`;

    // Check if the uploads directory exists, if not create it
    if (!fs.existsSync("./uploads")) {
      fs.mkdirSync("./uploads");
      console.log("Uploads directory created");
    }

    // Download the file to the local path
    await downloadFile(fileLink.href, localPath);
    console.log("File downloaded to:", localPath);

    // Upload the file to S3 and save the book information
    const s3Key = `books/${fileName}`;
    console.log("About to upload to S3 with key:", s3Key);
    const book = await uploadAndSaveBook(
      localPath,
      s3Key,
      "Testing a book",
      "Hello",
      "67e68461e6f25bcaeaed3b82",
      fileId
    );
    console.log("Book uploaded and saved:", book);
    // Send a message to the user with the book information
    fs.unlinkSync(localPath); // Clean up the local file after upload
    ctx.reply(`Book added ${book.title} by ${book.author}`);
  } catch (error) {
    console.error("Error adding book:", error.message, error.stack);
    ctx.reply(`Error adding book: ${error.message}`);
  }
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

  // Graceful shutdown: kills the processes gradually to avoid memory problems
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
});
