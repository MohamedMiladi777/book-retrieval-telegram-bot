import { HfApi, HfFolder } from "@huggingface/hub";
import axios from "axios";
import fs from "fs";
import path from "path";
import { AbortController } from "abort-controller";
import { logger } from "../logs/logger.js";
import pRetry from "p-retry";
import { pipeline } from "stream/promises";

// Initialize Hugging Face API client
const hf = new HfApi();
const datasetOwner = process.env.HF_DATASET_OWNER || "waqfeya";
const datasetName = process.env.HF_DATASET_NAME || "books";
const token = process.env.HF_API_TOKEN || HfFolder.getToken();

/**
 * Search for books in the Hugging Face dataset
 *
 * @param {Object} query - Search parameters (title, author, category)
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} - Array of matching books
 */
export async function searchBooks(query = {}, limit = 10) {
  try {
    logger.info(`Searching for books with query: ${(query, limit)}`);

    // Create search query string from prams
    const searchQuery = Object.entries(query)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}:${value}`)
      .join(" AND ");

    // Use Hugging Face API to search the dataset
    const searchResults = await hf.datasetSearch({
      search: searchQuery || undefined,
      owner: datasetOwner,
      name: datasetName,
      limit,
    });

    logger.info(`Found ${searchResults.length} books matching query`, {
      query,
    });
    return searchResults;
  } catch (error) {
    logger.error("Error searching for books:", {
      error: error.message,
      query,
    });

    throw new Error(`Failed to search books: ${error.message}`);
  }
}

/**
 * Download a file from Hugging Face dataset with retry logic and timeout
 *
 * @param {string} fileUrl - URL of file in Hugging Face dataset
 * @param {string} outputPath - Local path to save file
 * @param {number} timeout - Timeout in milliseconds
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<string>} - Path to downloaded file
 */

export async function downloadHfFile(
  fileUrl,
  outputPath,
  timeout = parseInt(process.env.HF_DOWNLOAD_TIMEOUT || 60000),
  maxRetries = parseInt(process.env.HF_DOWNLOAD_RETRIES || 3)
) {
  return pRetry(async () => {
    const controller = new AbortController();
    // Set timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      logger.info("Searching books in Hugging Face dataset", { query, limit });

      // Ensure Parent directory exists
      const dir = path.dirname(outputPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create write stream
      const writer = fs.createWriteStream(outputPath);

      // Download file with abort signal for timeout handling
      const response = await axios.get(fileUrl, {
        responseType: "stream",
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      // Use Pipeline to stream response to file
      await pipeline(response.data, fs.createWriteStream(outputPath));
    } catch (error) {}
  });
}
