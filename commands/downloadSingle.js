import FormData from "form-data";
import BookService from "../services/bookService.js";
import { logger } from "../logs/logger.js";

const downloadCommand = async (ctx, bookService) => {
  const MAX_SIZE = 20 * 1024 * 1024;
  let fileUrl = null;
  try {
    console.log("DEBUG: bookService is:", bookService);
    console.log("DEBUG: bookService type:", typeof bookService);
    // Extract callback data
    const callbackData = ctx.callbackQuery?.data;
    console.log("Callback Data:", callbackData);

    if (!callbackData) {
      return ctx.reply("Invalid book selection.");
    }

    // Extract book ID
    const bookId = callbackData.replace("book_", "").trim();
    console.log("Extracted book ID:", bookId);

    // Fetch book from Hugging face
    const book = bookService.getBookById(bookId);
    console.log("Fetched Book:", book);
    if (!book) {
      throw new Error("No book found with the given ID.");
    }
    console.log("Fetched Book:", book);

    // Prepare file URL and name
    const fileUrl = book.downloadUrl; // e.g., books/Aqeedah/Khalal_v1.pdf
    if (!fileUrl) {
      throw Error(`Book "${book.title}" has no download URL`);
    }
    const fileName = `${book.title.replace(
      /[^a-zA-Z0-9\u0600-\u06FF ]/g,
      ""
    )}.pdf`;
    console.log("Prepared fileName:", fileName);

    // Get file size
    const fileSize = book.size;
    // Instead of:
    const uploadResponse = await ctx.replyWithDocument(fileUrl, {
      caption: book.author ? `${book.title} by ${book.author}` : book.title,
    });

    // if (!uploadResponse.data.ok) {
    //   throw new Error(`Upload failed: ${JSON.stringify(uploadResponse.data)}`);
    // }
    console.log("Document sent successfully, filesize is less than 50mb");
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
