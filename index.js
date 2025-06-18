import dotenv from "dotenv";
dotenv.config();
import express from "express";
import Book from "./models/bookModel.js";
import connectDB from "./config/database.js";
import Category from "./models/categoryModel.js";
import fs from "fs";
import { Markup, Telegraf } from "telegraf";
import categoriesCommand from "./commands/categories.js";
import bookCommand from "./commands/books.js";
import downloadCommand from "./commands/download.js";
import { uploadAndSaveBook } from "./utils/blob-storage-utils.js";
import { downloadFile } from "./utils/file-utils.js";
if (!process.env.BOT_TOKEN) throw new Error('"BOT_TOKEN" env var is required!');
//default to PORT 4040
const PORT = process.env.PORT || 4040;
const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

app.use(express.json());

//Connect to the database
console.log(`MongoDB URI: ${process.env.MONGODB_URI}`);
connectDB();

bot.telegram
  .setWebhook(`${process.env.WEBHOOK_URL}/bot`)
  .then(() => {
    console.log(`Webhook set to ${process.env.WEBHOOK_URL}/bot`);
  })
  .catch((error) => {
    console.error("Failed to set webhook:", error.message);
  });

bot.help((ctx) => ctx.reply("Help message"));
bot.command("categories", categoriesCommand);
bot.on("callback_query", async (ctx) => {
  const callbackData = ctx.callbackQuery?.data;
  if (callbackData?.startsWith("category_")) {
    await bookCommand(ctx);
  } else if (callbackData?.startsWith("book_")) {
    await downloadCommand(ctx);
  } else if (callbackData?.startsWith("series_")) {
    const seriesId = callbackData.replace("series_", "");
    const seriesBooks = await Book.find({ seriesId }).sort({ title: 1 });
    if (seriesBooks.length === 0) {
      return ctx.reply("No volumes found for this series.");
    }
    const keyboard = seriesBooks.map((book) => [
      Markup.button.callback(`📖 ${book.title}`, `book_${book._id.toString()}`),
    ]);
    await ctx.reply(
      "Select a volume:",
      Markup.inlineKeyboard(keyboard, { columns: 1 })
    );
  }
});

// Handle the /addbook command
bot.on("document", async (ctx) => {
  const caption = ctx.message?.caption || "";
  if (!caption.startsWith("/addbook")) return;

  console.log("Received /addbook command");
  console.log("Received message:", ctx.message);

  // const ADMIN_ID = "1921769988"
  // if (ctx.message.from.id !== ADMIN_ID) {
  //   return ctx.reply(
  //     "You are not authorized to use this command, contact the developer."
  //   );
  // }

  try {
    // parse caption for title, author and category
    const parts = caption.replace("/addbook", "").trim().split(",");
    const title =
      parts
        .find((p) => p.trim().startsWith("Title:"))
        ?.replace("Title:", "")
        .trim() || ctx.message.document.file_name.replace(".pdf", "");
    const author =
      parts
        .find((p) => p.trim().startsWith("Author:"))
        ?.replace("Author:", "")
        .trim() || "Unknown";

    const categoryName = parts
      .find((p) => p.trim().startsWith("Category:"))
      ?.replace("Category:", "")
      .trim();

    console.log("Parsed title:", title);
    console.log("Parsed author:", author);
    console.log("Parsed categoryName:", categoryName);

    if (!categoryName) {
      return ctx.reply(
        "Please provide a category in the format: Category: <category>"
      );
    }

    const category = await Category.findOne({ name: categoryName });
    console.log("Found category:", category);
    if (!category) {
      return ctx.reply(
        `Category "${categoryName}" not found. Available categories: ${await Category.find().then(
          (cats) => cats.map((c) => c.name).join(", ")
        )}`
      );
    }
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

    // Upload the file to Azure blob storage and save the book information
    // Upload to Azure Blob Storage
    const azureBlobName = `books/${fileName}`;
    console.log("About to upload to Azure with blobName:", azureBlobName);
    const book = await uploadAndSaveBook(
      localPath,
      azureBlobName,
      title,
      author,
      category._id,
      fileId
    );

    console.log("Book uploaded and saved:", book);
    fs.unlinkSync(localPath); // Clean up the local file after upload
    ctx.reply(`Book added: ${book.title} by ${book.author} in ${categoryName}`);
  } catch (error) {
    console.error("Error adding book:", error.message, error.stack);
    ctx.reply(`Error adding book: ${error.message}`);
  }
});

//     console.log("Book uploaded and saved:", book);
//     // Send a message to the user with the book information
//     fs.unlinkSync(localPath); // Clean up the local file after upload
//     ctx.reply(`Book added: ${book.title} by ${book.author} in ${categoryName}`);
//   } catch (error) {
//     console.error("Error adding book:", error.message, error.stack);
//     ctx.reply(`Error adding book: ${error.message}`);
//   }
// });
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
  console.log(`Server running on ${process.env.WEBHOOK_URL}`);
  // Graceful shutdown: kills the processes gradually to avoid memory problems
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
});
