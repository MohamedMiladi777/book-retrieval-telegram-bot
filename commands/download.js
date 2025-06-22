import Book from "../models/bookModel.js";
import axios from "axios";
import FormData from "form-data";
import { BlobServiceClient } from "@azure/storage-blob";
import dotenv from "dotenv";
import http from "http"; // Add this line

dotenv.config({ path: "../.env" });

const downloadCommand = async (ctx) => {
  const overallStart = Date.now();

  const blobServiceClient = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  const containerClient = blobServiceClient.getContainerClient(
    process.env.AZURE_CONTAINER_NAME || "books"
  );

  const MAX_SIZE = 20 * 1024 * 1024;
  let fileUrl = null;
  try {
    const step1 = Date.now();

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

    // Valide file URL

    const response = await axios.head(fileUrl, {
      timeout: 5000, // 5 seconds timeout
      headers: {
        "User-Agent": "TelegramBot",
        Accept: "application/pdf",
      },
    });

    if (response.status !== 200) {
      throw new Error(
        `Blob URL is not accessible: ${fileUrl} (Status: ${response.status})`
      );
    }
    const contentType = response.headers["content-type"]?.toLowerCase();
    if (!contentType?.includes("application/pdf")) {
      throw new Error(
        `Blob does not point to a PDF: ${fileUrl} (Content-Type: ${contentType})`
      );
    }

    ////**************   */
    // Generate SAS URL if blobs are private
    // Extract blob name without container prefix
    // const fullPath = fileUrl.split("/").slice(3).join("/"); // e.g., Aqeedah/Mokhtar.pdf
    // const fullPath = fileUrl.split("/").slice(4).join("/");
    // console.log("Derived Blob Name:", fullPath);
    // const blockBlobClient = containerClient.getBlockBlobClient(fullPath);

    // // Check if the file exists in Azure Blob Storage
    // // const blobName = fileUrl.split("/").slice(-2).join("/");
    // // const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    // const properties = await blockBlobClient.getProperties();
    // const step2 = Date.now();
    // console.log(
    //   `[PROFILE] Step 1: Get Blob Properties: ${(step2 - step1) / 1000}s`
    // );

    // console.log("Blob Properties:", properties);
    // if (properties.contentType?.toLowerCase() !== "application/pdf") {
    //   throw new Error(
    //     `Blob does not point to a PDF: ${fileUrl} (Content-Type: ${properties.contentType})`
    //   );
    // }
    ///////*******************   */
    // Get file size
    const fileSize = parseInt(response.headers["content-length"], 10);
    console.log("File Size:", fileSize);

    // Stream file directly from Azure Blob Storage (public URL)
    const downloadResponse = await axios({
      method: "get",
      url: fileUrl,
      responseType: "stream",
    });
    const fileStream = downloadResponse.data;

    const formData = new FormData();
    formData.append("chat_id", ctx.chat.id);
    formData.append("document", fileStream, {
      filename: fileName,
      contentType: "application/pdf",
    });
    formData.append("caption", `${book.title} by ${book.author}`);

    const TELEGRAM_API = process.env.TELEGRAM_API || "https://api.telegram.org";

    let endpoint;
    if (fileSize < MAX_SIZE) {
      endpoint = "https://api.telegram.org";
      console.log("Using official Telegram API endpoint for small file.");
    } else {
      endpoint = process.env.TELEGRAM_API_ROOT || "http://172.205.217.2:8081";
      console.log(
        "Using self-hosted Telegram Bot API endpoint for large file."
      );
    }
    // Send file directly to Telegram via streaming

    const startTime = Date.now();
    console.log("Starting file upload to Telegram...");

    const uploadStart = Date.now();
    const uploadResponse = await axios.post(
      `${endpoint}/bot${process.env.BOT_TOKEN}/sendDocument`,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000, // Increase to 120 seconds for large files
        maxRedirects: 5, // Allow more redirects if needed
        httpAgent: new http.Agent({ keepAlive: true }), // Enable keep-alive for better connection reuse
        timeout: fileSize > 20 * 1024 * 1024 ? 600000 : 30000, // 10min for large files
      }
    );

    const uploadEnd = Date.now();

    if (!uploadResponse.data.ok) {
      throw new Error(
        `Telegram API upload failed: ${JSON.stringify(uploadResponse.data)}`
      );
    }

    await ctx.reply("Your book has been sent!");
    const overallEnd = Date.now();
    console.log(`[PROFILE] Total time: ${(overallEnd - overallStart) / 1000}s`);

    // let uploadEndpoint;
    // let timeout;
    // if (fileSize < MAX_SIZE) {
    //   console.log("Sending small file via Telegram API");
    //   uploadEndpoint = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendDocument`;
    //   // timeout = 30000; // 30 seconds for small files
    // } else {
    //   console.log("Proxying large file via hosted bot");
    //   uploadEndpoint = `http://15.236.218.255/bot${process.env.BOT_TOKEN}/sendDocument`;
    //   // timeout = 60000; // 60 seconds for large files
    // }

    // const uploadResponse = await axios.post(uploadEndpoint, formData, {
    //   headers: formData.getHeaders(),
    //   timeout,
    //   maxContentLength: Infinity,
    //   maxBodyLength: Infinity,
    // });
    const endTime = Date.now();
    console.log(
      `Upload took ${((endTime - startTime) / 1000).toFixed(2)} seconds`
    );

    // if (!uploadResponse.data.ok) {
    //   throw new Error(`Upload failed: ${JSON.stringify(uploadResponse.data)}`);
    // }
    // console.log(
    //   `Document sent successfully via ${
    //     fileSize < MAX_SIZE ? "Telegram API" : "hosted bot"
    //   }`
    // );
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
