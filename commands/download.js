import { time } from "console";
import Book from "../models/bookModel.js";
import axios from "axios";

// Define the async function
const downloadCommand = async (ctx) => {
  try {
    // Extract callback data
    const callbackData = ctx.callbackQuery?.data;
    console.log("Callback Data:", callbackData);

    if (!callbackData) {
      return ctx.reply("Invalid book selection.");
    }

    // Extract book title from callbackData
    const bookId = callbackData.replace("book_", "").trim();
    console.log("Extracted book ID:", bookId);

    // Query MongoDB to find the book by title
    const book = await Book.findById(bookId);
    // If no book is found, inform the user and return
    if (!book) {
      throw new Error("No book found with the given ID.");
    }
    console.log("Fetched Book:", book);

    //Prepare the file URL and filename
    const fileUrl = book.downloadUrl;
    const fileName = `${book.title.replace(/[^a-zA-Z0-9 ]/g, "")}.pdf`; // Sanitize filename

    // Validate the S3 URL
    console.log("Validating S3 URL:", fileUrl);
    const response = await axios.head(fileUrl, {
      timeout: 5000,
      headers: {
        "User-Agent": "TelegramBot",
        Accept: "application/pdf",
      },
    });
    console.log("S3 HEAD Response:", {
      status: response.status,
      headers: response.headers,
    });
    if (response.status !== 200) {
      throw new Error(
        `S3 URL is not accessible : ${fileUrl} (Status: ${response.status})`
      );
    }

    const contentType = response.headers["content-type"]?.toLowerCase();
    if (!contentType?.includes("application/pdf")) {
      throw new Error(
        `S3 URL does not point to a PDF: ${fileUrl} (Content-Type: ${contentType})`
      );
    }

    // Log fetched book
    console.log("Fetched Book:", book);

    // Send download link
    // await ctx.reply(`📥 Click below to download:\n${book.downloadUrl}`);
    console.log("Attempting to send document:", {
      url: fileUrl,
      filename: fileName,
    });

    try {
      await ctx.replyWithDocument(
        {
          url: fileUrl,
          filename: fileName,
        },
        {
          caption: `${book.title} by ${book.author}`,
        }
      );
    } catch (docError) {
      console.error("Failed to send document:", {
        message: docError?.message || "No error message",
        stack: docError?.stack || "No stack trace",
        response: docError?.response
          ? {
              status: docError.response.status,
              data: docError.response.data,
            }
          : "No response data",
        code: docError?.code || "No error code",
      });
      // Fallback: Send URL as text
      await ctx.reply(
        `Unable to send the document directly. Download it here:\n${fileUrl}`,
        { caption: `${book.title} by ${book.author}` }
      );
      console.log("Sent fallback text link");
    }
  } catch (error) {
    console.error("Error in downloadCommand:", {
      message: error?.message || "No error message",
      stack: error?.stack || "No stack trace",
      code: error?.code || "No error code",
    });
    let userMessage = "❌ An error occurred while fetching the book.";
    if (error.message.includes("No book found")) {
      userMessage = "❌ Book not found.";
    } else if (error.message.includes("S3 URL")) {
      userMessage = `❌ Unable to access the book file: ${error.message}`;
    }
    await ctx.reply(userMessage);
    console.log("Sent error message to user:", userMessage);
  }
};

// Export the function
export default downloadCommand;
