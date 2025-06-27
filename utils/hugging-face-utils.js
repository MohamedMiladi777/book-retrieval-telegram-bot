//import HfHub from "@huggingface/hub";
import * as hub from "@huggingface/hub";
import axios from "axios";
import fs from "fs";
import path from "path";
import { AbortController } from "abort-controller";
import { logger } from "../logs/logger.js";
import pRetry from "p-retry";
import { pipeline } from "stream/promises";

// Initialize Hugging Face API client
const datasetOwner = process.env.HF_DATASET_OWNER || "waqfeya";
const datasetName = process.env.HF_DATASET_NAME || "books";
const token = process.env.HF_API_TOKEN;

// Valide config
if (!token) {
  logger.warn("Hugging Face API token is not set. Some features may not work.");
}

/**
 * Get list of all files in the Waqfeya dataset
 * This replaces listing files from Azure Blob Storage
 *
 * @returns {Promise<Array>} Array of file objects with metadata
 */

export async function listDatasetFiles() {
  const timer = logger.timeOperation("list_dataset_files");

  try {
    logger.info("Fetching file list from Waqfeya Hugging Face dataset", {
      dataset: `${datasetOwner}/${datasetName}`,
    });

    // Use HF API to list all files in the dataset
    const repo = { type: "dataset", name: `${datasetOwner}/${datasetName}` };
    const files = [];
    for await (const file of hub.listFiles({ repo, accessToken: token })) {
      files.push(file);
    }

    // Filder for PDF files only (Probability don't need it for now)
    const pdfFiles = files.filter((file) => file.path.endsWith(".pdf"));
    timer.end(true, { totalFiles: files.length, pdfFiles: pdfFiles.length });
    logger.info("Successfully fetched dataset files", {
      totalFiles: files.length,
      pdfFiles: pdfFiles.length,
    });

    return pdfFiles.map((file) => ({
      name: path.basename(file.path),
      path: file.path,
      size: file.size,
      lastModified: file.lastCommit?.date,
      downloadUrl: `https://huggingface.co/datasets/${datasetOwner}/${datasetName}/resolve/main/${file.path}`,
    }));

    return;
  } catch (error) {
    timer.end(false, { error: error.message });
    logger.error("Failed to list dataset files", {
      error: error.message,
      dataset: `${datasetOwner}/${datasetName}`,
    });
    throw new Error(`Failed to list dataset files: ${error.message}`);
  }
}

/**
 * Search for books in the dataset by metadata
 * This provides search functionality similar to querying Azure Blob Storage
 *
 * @param {Object} query - Search parameters (title, author, category)
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of matching books
 */

export async function searchBooks(query = {}, limit = 50) {
  const timer = logger.timeOperation("search_books");

  try {
    logger.info("Searching books in dataset", { query, limit });

    // Get all files first (In production, consider caching this)
    const files = await listDatasetFiles();

    // Simple search implementation, in production I will consider using a more efficient search index
    let filteredFiles = files;

    // Filter by Category (Based on file Path)
    if (query.category) {
      filteredFiles = filteredFiles.filter((file) =>
        file.path.toLowerCase().includes(query.category.toLowerCase())
      );
    }

    // Filter by title (Based on file name)
    if (query.title) {
      filteredFiles = filteredFiles.filter((file) =>
        file.name.toLowerCase().includes(query.title.toLowerCase())
      );
    }

    // Limit results
    const results = filteredFiles.slice(0, limit);
    timer.end(true, {
      resultsFound: results.length,
      queryTerm: Object.keys(query).length,
    });

    logger.info("Search completed", {
      query,
      resultsFound: results.length,
      totalSearched: filteredFiles.length,
    });

    return results;
  } catch (error) {
    timer.end(false, { error: error.message });
    logger.error("Search failed", { error: error.message, query });
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Download a file from Hugging Face dataset with retry logic
 * This replaces Azure Blob Storage downloads with proper error handling
 *
 * @param {string} filePath - Path of file in dataset (e.g., "category/book.pdf")
 * @param {string} outputPath - Local path to save file
 * @param {Object} options - Download options
 * @returns {Promise<string>} Path to downloaded file
 */

export async function downloadHfFile(filePath, outputPath, options = {}) {
  const {
    timeout = parseInt(process.env.DOWNLOAD_TIMEOUT_MS || 120000),
    maxRetries = parseInt(process.env.MAX_RETRIES || 3),
    chunkSize = parseInt(process.env.CHUNK_SIZE_MB || 4) * 1024 * 1024,
  } = options;

  const timer = logger.timeOperation("hf_file_download");
  return pRetry(
    async (attemptNumber) => {
      const controller = new AbortController();

      // Set timeout that aborts request
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeout);

      try {
        logger.info("Starting Hugging Face download", {
          filePath,
          outputPath,
          attempt: attemptNumber,
          timeout: `${timeout}ms`,
        });

        // Ensure parent directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        // Construct download URL
        const downloadUrl = `https://huggingface.co/datasets/${datasetOwner}/${datasetName}/resolve/main/${filePath}`;

        // Make request with abort signal for timeout handling
        const response = await axios.get(downloadUrl, {
          responseType: "stream",
          signal: controller.signal,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          timeout: timeout * 0.8, // Axios timeout slightly less than abort timeout
        });

        // Log response info
        const contentLength = response.headers["content-length"];
        const fileSize = contentLength ? parseInt(contentLength) : "unknown";

        logger.info("Download response received", {
          status: response.status,
          fileSize,
          contentType: response.headers["content-type"],
        });

        // Use pipeline to handle streaming download, pipe is not safe :)
        await pipeline(response.data, fs.createWriteStream(outputPath));

        clearTimeout(timeoutId);
        const duration = timer.end(true, {
          filePath,
          fileSize,
          attempt: attemptNumber,
        });
        logger.info("Download completed successfully", {
          filePath,
          outputPath,
          duration,
          attempt: attemptNumber,
        });

        return outputPath;
      } catch (error) {
        clearTimeout(timeoutId);

        // Log the specific error for this attempt
        logger.warn("Download attempt failed", {
          filePath,
          attempt: attemptNumber,
          error: error.message,
          code: error.code,
          willRetry: attemptNumber < maxRetries,
        });

        // Re-throw to trigger retry
        throw error;
      }
    },
    {
      retries: maxRetries,
      factor: 2, // Exponential backoff: 1s, 2s, 4s...
      minTimeout: 1000,
      maxTimeout: 10000,
      onFailedAttempt: (error) => {
        logger.warn("Retry attempt failed", {
          filePath,
          attemptNumber: error.attemptNumber,
          retriesLeft: error.retriesLeft,
          error: error.message,
        });
      },
    }
  ).catch((error) => {
    timer.end(false, { error: error.message, filePath });
    logger.error("Download failed after all retries", {
      filePath,
      outputPath,
      maxRetries,
      finalError: error.message,
    });
    throw new Error(
      `Download failed after ${maxRetries} attempts: ${error.message}`
    );
  });
}

/**
 * Get direct download URL for a file in the dataset
 * This replaces Azure Blob Storage direct URLs
 *
 * @param {string} filePath - Path of file in dataset
 * @returns {string} Direct download URL
 */
export function getFileDownloadUrl(filePath) {
  if (!filePath) {
    throw new Error("File path is required to get download URL");
  }

  return `https://huggingface.co/datasets/${datasetOwner}/${datasetName}/resolve/main/${filePath}`;
}

/**
 * Upload a file to the Hugging Face dataset (requires write permissions)
 * This replaces Azure Blob Storage uploads
 *
 * @param {string} localFilePath - Path to local file
 * @param {string} datasetPath - Path within dataset
 * @param {Object} commitMessage - Git commit message for the upload
 * @returns {Promise<Object>} Upload result
 *I will later create my own dataset
 */

export async function uploadToDataset(
  localFilePath,
  datasetPath,
  commitMessage = "Add new boob"
) {
  const timer = logger.timeOperation("hf_upload");

  if (!token) {
    throw new Error("HF_API_TOKEN required for uploads");
  }

  try {
    logger.info("Starting upload to Hugging Face dataset", {
      localFilePath,
      datasetPath,
      commitMessage,
    });

    // Read file content
    const fileContent = fs.readFileSync(localFilePath);

    // Upload using HF API
    const repo = { type: "dataset", name: `${datasetOwner}/${datasetName}` };
    const result = await hub.uploadFiles({
      repo,
      accessToken: token,
      files: [
        {
          path: datasetPath,
          content: fileContent,
        },
      ],
      commitMessage,
    });

    timer.end(true, { datasetPath, fileSize: fileContent.length });

    logger.info("Upload completed successfully", {
      localFilePath,
      datasetPath,
      commitUrl: result.commitUrl,
    });

    return {
      success: true,
      commitUrl: result.commitUrl,
      downloadUrl: getFileDownloadUrl(datasetPath),
    };
  } catch (error) {
    timer.end(false, { error: error.message });
    logger.error("Upload failed", {
      error: error.message,
      localFilePath,
      datasetPath,
    });
    throw new Error(`Upload failed: ${error.message}`);
  }
}
