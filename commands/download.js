import Book from "../models/bookModel.js";
import axios from "axios";
import FormData from "form-data";

const downloadCommand = async (ctx) => {
  let fileUrl = null;
  try {
    // Extract callback data
    const callbackData = ctx.callbackQuery?.data;
    console.log("Callback Data:", callbackData);

    if (!callbackData) {
      return ctx.reply("Invalid book selection.");
    }

    // Extract book ID
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
    const fileUrl = book.downloadUrl; // e.g., books/Aqeedah/Khalal_v1.pdf
    if (!fileUrl) {
      throw Error(`Book "${book.title}" has no download URL`);
    }
    const fileName = `${book.title.replace(
      /[^a-zA-Z0-9\u0600-\u06FF ]/g,
      ""
    )}.pdf`;
    console.log("Prepared fileName:", fileName);

    // Validate the URL
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
        `S3 URL is not accessible: ${fileUrl} (Status: ${response.status})`
      );
    }
    const contentType = response.headers["content-type"]?.toLowerCase();
    if (!contentType?.includes("application/pdf")) {
      throw new Error(
        `S3 URL does not point to a PDF: ${fileUrl} (Content-Type: ${contentType})`
      );
    }

    // Get file size
    const fileSize = parseInt(response.headers["content-length"], 10);
    console.log("File Size:", fileSize, "bytes");
    const downloadResponse = await axios({
      method: "get",
      url: fileUrl,
      responseType: "stream",
    });

    const formData = new FormData();
    formData.append("chat_id", ctx.chat.id);
    formData.append("document", downloadResponse.data, {
      filename: fileName,
      contentType: "application/pdf",
    });
    formData.append("caption", `${book.title} by ${book.author}`);

    console.log("Uploading document to Telegram");

    const uploadResponse = await axios.post(
      `http://15.236.218.255/bot${process.env.BOT_TOKEN}/sendDocument`,
      formData,
      { headers: formData.getHeaders(), timeout: 60000 }
    );

    if (!uploadResponse.data.ok) {
      throw new Error(`Upload failed: ${JSON.stringify(uploadResponse.data)}`);
    }

    console.log("Document sent successfully");
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
