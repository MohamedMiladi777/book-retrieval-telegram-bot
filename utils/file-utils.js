import { logger } from "../logs/logger.js";import axios from "axios";
import fs from "fs";

// This function downloads a file from a given URL and saves it to the specified output path
// It uses axios to make the HTTP GET request and streams the response data to a file
// It returns a promise that resolves with the output path of the downloaded file
// The function handles errors and logs them to the console
// and rethrows the error for further handling
const downloadFile = async (
  url,
  outputPath,
  timeout = parseInt(process.env.DOWNLOAD_TIMEOUT_MS || 120000)
) => {
  const timer = logger.timeOperation("file_download");
  logger.info(`Starting download`, {
    url: url, // Log entire url
    outputPath,
    timeout,
  });

  try {
    // Make http request with timeout and streaming response
    const response = await axios.get(url, {
      // method: "GET",
      responseType: "stream",
      timeout: Number(timeout),
    });
    // get file size from response headers
    const contentLength = response.headers["content-length"];
    const fileSize = contentLength ? parseInt(contentLength) : "unknown";

    logger.info(`Download started`, {
      fileSize,
      contentType: response.headers["content-type"],
    });

    // Create a write stream to the output path
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        const duration = timer.end(true, { fileSize });
        logger.info(`Download completed successfully`, {
          outputPath,
          duration,
        });
        resolve(outputPath);
      });

      writer.on("error", (err) => {
        timer.end(false, { error: err.message });
        logger.error(`Error writing file`, {
          error: err.message,
          outputPath,
          code: err.code,
        });
        reject(err);
      });

      // Add download timeout - prevents hanging on slow connections
      const downloadTimeout = setTimeout(() => {
        writer.close(); // Close the file stream
        const err = new Error(`Download timeout after ${timeout}ms`);
        timer.end(false, { error: "timeout", timeout });
        logger.error(`Download timeout`, { timeout, outputPath });
        reject(err);
      }, Number(timeout));

      // Clear timeout when download finishes successfully
      writer.on("finish", () => clearTimeout(downloadTimeout));
      writer.on("error", () => clearTimeout(downloadTimeout));
    });
  } catch (error) {
    console.error("Error downloading file:", error.message);
    throw error;
  }
};

export { downloadFile };
