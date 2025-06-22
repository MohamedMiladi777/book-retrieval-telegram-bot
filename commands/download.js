import Book from "../models/bookModel.js";
import axios from "axios";
import FormData from "form-data";
import dotenv from "dotenv";
import http from "http"; // For http.Agent

dotenv.config({ path: "../.env" });

const downloadCommand = async (ctx) => {
  let fileUrl = null;
  try {
    // Extract callback data and acknowledge immediately
    const callbackData = ctx.callbackQuery?.data;
    console.log("Callback Data:", callbackData);

    if (!callbackData) {
      return ctx.reply("Invalid book selection.");
    }
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery();
    }

    const bookId = callbackData.replace("book_", "").trim();
    console.log("Extracted book ID:", bookId);

    if (!/^[0-9a-f]{24}$/i.test(bookId)) {
      throw new Error(`Invalid book ID format: ${bookId}`);
    }

    // Fetch book from MongoDB
    const book = await Book.findById(bookId);
    if (!book) {
      throw new Error("No book found with the given ID.");
    }
    console.log("Fetched Book:", book);

    // Prepare file URL and name
    fileUrl = book.downloadUrl;
    if (!fileUrl) {
      throw new Error(`Book "${book.title}" has no download URL`);
    }
    const fileName = `${book.title.replace(/[^a-zA-Z0-9\u0600-\u06FF ]/g, "")}.pdf`;
    console.log("Prepared fileName:", fileName);

    // Check cached Telegram file_id
    if (book.telegramFileId) {
      console.log("Using cached Telegram file_id:", book.telegramFileId);
      await ctx.replyWithDocument(book.telegramFileId, {
        caption: `${book.title} by ${book.author}`,
      });
      return;
    }

    // Validate URL with timing
    console.time("Azure HEAD request");
    const headResponse = await axios.head(fileUrl, {
      timeout: 5000,
      headers: { "User-Agent": "TelegramBot", Accept: "application/pdf" },
    });
    console.timeEnd("Azure HEAD request");

    if (headResponse.status !== 200) {
      throw new Error(`URL is not accessible (Status: ${headResponse.status})`);
    }
    const contentType = headResponse.headers["content-type"]?.toLowerCase();
    if (!contentType?.includes("application/pdf")) {
      throw new Error(`URL does not point to a PDF (Content-Type: ${contentType})`);
    }

    const fileSize = parseInt(headResponse.headers["content-length"], 10);
    console.log("File Size:", fileSize, "bytes");

    // Status message
    const statusMessage = await ctx.reply("📚 Preparing your book...");

    // Stream the file directly
    console.time("Azure GET request");
    const downloadResponse = await axios({
      method: "get",
      url: fileUrl,
      responseType: "stream",
    });
    console.timeEnd("Azure GET request");

    const formData = new FormData();
    formData.append("chat_id", ctx.chat.id);
    formData.append("document", downloadResponse.data, {
      filename: fileName,
      contentType: "application/pdf",
    });
    formData.append("caption", `${book.title} by ${book.author}`);

    // Use self-hosted endpoint for large files
    const TELEGRAM_API =
      fileSize > 20 * 1024 * 1024
        ? process.env.TELEGRAM_API_ROOT || "http://172.205.217.2:8081"
        : "https://api.telegram.org";

    console.log("Starting file upload to Telegram...");
    const startTime = Date.now();

    // Magic upload configuration
    const uploadResponse = await axios.post(
      `${TELEGRAM_API}/sendDocument`, // Direct endpoint call
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000, // 120 seconds
        maxRedirects: 5,
        httpAgent: new http.Agent({ keepAlive: true }), // The magic ingredient
      }
    );

    const endTime = Date.now();
    console.log(`Upload took ${((endTime - startTime) / 1000).toFixed(2)} seconds`);

    if (!uploadResponse.data.ok) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadResponse.data)}`);
    }

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMessage.message_id);

    // Cache the file_id for future use
    if (uploadResponse.data.result && uploadResponse.data.result.document) {
      const telegramFileId = uploadResponse.data.result.document.file_id;
      await Book.findByIdAndUpdate(bookId, { telegramFileId });
      console.log("Saved Telegram file_id for future use");
    }
  } catch (error) {
    console.error("Error in downloadCommand:", {
      message: error.message || "No error message",
      stack: error.stack || "No stack trace",
      code: error.code || "No error code",
      response: error.response
        ? { status: error.response.status, data: error.response.data }
        : "No response data",
    });
    const errorMessage = fileUrl
      ? `Unable to send the document. Click to download:\n${fileUrl}`
      : `Unable to send the document: ${error.message}`;
    const replyMarkup = fileUrl
      ? {
          reply_markup: {
            inline_keyboard: [[{ text: "Download PDF", url: fileUrl }]],
          },
        }
      : {};

    await ctx.reply(errorMessage, replyMarkup);
    console.log("Sent error message to user");
  }
};

export default downloadCommand;