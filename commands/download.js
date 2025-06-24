import Book from "../models/bookModel.js";
import axios from "axios";
import FormData from "form-data";
import { BlobServiceClient } from "@azure/storage-blob";

const downloadCommand = async (ctx) => {

  
  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_CONTAINER_NAME || "books"
  );

  const MAX_SIZE = 20 * 1024 * 1024;
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

    // Check if the file exists in Azure Blob Storage
    const blobName = fileUrl.split("/").slice(-2).join("/");
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const properties = await blockBlobClient.getProperties();
    console.log("Blob Properties:", properties);
    if (properties.contentType?.toLowerCase() !== "application/pdf") {
      throw new Error(
        `Blob does not point to a PDF: ${fileUrl} (Content-Type: ${properties.contentType})`
      );
    }

    // Get file size
    const fileSize = properties.contentLength;
    console.log("Sending data with Azure Blob URL directly");
    if (fileSize < MAX_SIZE) {
      console.log("sending data with S3 URL directly");
      const uploadResponse = await axios.post(
        `https://${process.env.AZURE_APP_NAME}.azurewebsites.net/bot${process.env.BOT_TOKEN}/sendDocument`,
        {
          chat_id: ctx.chat.id,
          document: fileUrl,
          caption: `${book.title} by ${book.author}`,
        },
        { timeout: 30000 }
      );

      if (!uploadResponse.data.ok) {
        throw new Error(
          `Upload failed: ${JSON.stringify(uploadResponse.data)}`
        );
      }
      console.log("Document sent successfully, filesize is less than 50mb");
    } else {
      const downloadResponse = await blockBlobClient.download();

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
        throw new Error(
          `Upload failed: ${JSON.stringify(uploadResponse.data)}`
        );
      }

      console.log("Document sent successfully");
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