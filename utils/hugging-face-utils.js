// utils/hugging-face-utils.js
import * as hub from "@huggingface/hub";
import axios from "axios";
import fs from "fs";
import { config } from "dotenv";
import path from "path";
import { logger } from "../logs/logger.js";
import pRetry from "p-retry";

// Load environment variables
config();

// Dataset configuration
const datasetOwner = process.env.HF_DATASET_OWNER || "ieasybooks-org";
const datasetName = process.env.HF_DATASET_NAME || "waqfeya-library";
const token = process.env.HF_API_TOKEN || "";
const maxFiles = parseInt(process.env.MAX_DATASET_FILES || "1000");

// Validate configuration
if (!token) {
  logger.warn("Hugging Face API token missing. Some features may not work.", {
    dataset: `${datasetOwner}/${datasetName}`,
  });
} else {
  logger.info("Hugging Face configured", {
    dataset: `${datasetOwner}/${datasetName}`,
    hasToken: !!token,
  });
}

/**
 * Get repository designation for the dataset
 * @returns {Object} Repository designation object
 */
function getRepoDesignation() {
  return {
    type: "dataset",
    name: `${datasetOwner}/${datasetName}`,
  };
}

/**
 * Extract category from file path
 * Example: "docx/1ـ 211.0 (267) علوم القرآن/00031ـ كتب غريب القرآن الكريم --- حسين بن محمد نصار.PDF"
 * @param {string} filePath - Full file path
 * @returns {string} Extracted category name
 */
function extractCategoryFromPath(filePath) {
  // Remove docx/ or pdf/ prefix
  const cleanPath = filePath.replace(/^(docx|pdf)\//, "");
  const pathParts = cleanPath.split("/");
  if (pathParts.length >= 1) {
    const categoryPart = pathParts[0]; // e.g., "1ـ 211.0 (267) علوم القرآن"
    // Extract category name after numerical prefix, e.g., "علوم القرآن"
    const match = categoryPart.match(/\)\s*(.+)$/);
    const category = match ? match[1].trim() : categoryPart;
    logger.debug("Extracted category", { filePath, category });
    return category;
  }
  logger.warn("Could not extract category from path", { filePath });
  return "Unknown";
}

/**
 * Extract book title and author from folder name
 * Example: "00031ـ كتب غريب القرآن الكريم --- حسين بن محمد نصار.PDF"
 * @param {string} folderName - Book folder name
 * @returns {Object} - {title, author}
 */
function extractBookMetadata(folderName) {
  const cleaned = folderName.replace(/^\d+ـ\s*/, "").replace(/\.PDF$/, "");
  const parts = cleaned.split(" --- ");
  return {
    title: parts[0] ? parts[0].trim() : "Unknown Title",
    author: parts[1] ? parts[1].trim() : "Unknown Author",
  };
}
/**
 * List all PDF files in the Waqfeya dataset
 * Processes files iteratively to avoid memory issues
 * @returns {Promise<Array>} Array of file objects with metadata
 */
export async function listDatasetFiles() {
  const timer = logger.timeOperation("list_dataset_files");
  try {
    logger.info("Fetching file list from Waqfeya dataset", {
      dataset: `${datasetOwner}/${datasetName}`,
    });

    const repo = getRepoDesignation();
    const files = [];
    let count = 0;
    const rawPaths = [];

    // Iterate files to reduce memory usage
    for await (const fileInfo of hub.listFiles({
      repo: `datasets/${datasetOwner}/${datasetName}`,
      accessToken: token,
      recursive: true,
    })) {
      // if (count >= maxFiles) {
      //   logger.warn("Reached max file limit", { maxFiles });
      //   break;
      // }
      rawPaths.push(fileInfo.path);
      // Filter for book folder paths ending in .PDF under docx/
      if (
        fileInfo.path &&
        fileInfo.path.toLowerCase().endsWith(".pdf") &&
        fileInfo.path.startsWith("docx/")
      ) {
        files.push(fileInfo);
      }
      count++;
    }

    // Debug: Log first 20 raw paths to inspect more files
    logger.info("Raw file paths from API", {
      totalFiles: count,
      sampleRawPaths: rawPaths.slice(0, 20),
    });

    // Transform files with metadata
    const pdfFiles = files.map((file) => {
      const category = extractCategoryFromPath(file.path);
      const pathParts = file.path.split("/"); // Define pathParts
      const folderName = pathParts[2] || pathParts[1]; // Book folder
      const metadata = extractBookMetadata(folderName);
      // Construct actual PDF path by replacing docx/ with pdf/ and appending الكتاب.pdf
      const actualFilePath = file.path.replace(/^docx\//, "pdf/") + "/الكتاب.pdf";
      return {
        name: metadata.title,
        path: actualFilePath,
        size: file.size || 0,
        lastModified: file.lastCommit?.date,
        downloadUrl: `https://huggingface.co/datasets/${datasetOwner}/${datasetName}/resolve/main/${encodeURIComponent(actualFilePath)}`,
        category,
        author: metadata.author,
        title: metadata.title,
        originalFolder: folderName,
        fileName: "الكتاب.pdf", // Actual file name
      };
    });

    timer.end(true, { totalFiles: count, pdfFiles: pdfFiles.length });
    logger.info("Successfully listed dataset files", {
      totalFiles: count,
      pdfFiles: pdfFiles.length,
      samplePaths: pdfFiles.slice(0, 5).map((f) => f.path),
    });
    return pdfFiles;
  } catch (error) {
    timer.end(false, { error: error.message });
    logger.error("Failed to list dataset files", {
      error: error.message,
      dataset: `${datasetOwner}/${datasetName}`,
      stack: error.stack,
    });
    throw new Error(`Failed to list dataset files: ${error.message}`);
  }
}

/**
 * Search books by metadata (title, author, category)
 * @param {Object} query - Search parameters
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Matching books
 */
export async function searchBooks(query = {}) {
  const timer = logger.timeOperation("search_books");
  try {
    logger.info("Searching books in dataset", { query });
    const files = await listDatasetFiles();

    let filteredFiles = files;
    if (query.category) {
      filteredFiles = filteredFiles.filter(
        (file) =>
          file.category &&
          file.category.toLowerCase().includes(query.category.toLowerCase())
      );
    }
    if (query.title) {
      filteredFiles = filteredFiles.filter(
        (file) =>
          file.title &&
          file.title.toLowerCase().includes(query.title.toLowerCase())
      );
    }
    if (query.author) {
      filteredFiles = filteredFiles.filter(
        (file) =>
          file.author &&
          file.author.toLowerCase().includes(query.author.toLowerCase())
      );
    }

    const results = filteredFiles.slice(0);
    timer.end(true, {
      resultsFound: results.length,
      queryTerms: Object.keys(query).length,
    });
    logger.info("Search completed", {
      query,
      resultsFound: results.length,
      totalSearched: filteredFiles.length,
    });
    return results;
  } catch (error) {
    timer.end(false, { error: error.message });
    logger.error("Search failed", {
      error: error.message,
      query,
      stack: error.stack,
    });
    throw new Error(`Search failed: ${error.message}`);
  }
}

/**
 * Download a file from Hugging Face with retry logic and streaming
 * @param {string} filePath - Dataset file path
 * @param {string} outputPath - Local save path
 * @param {Object} options - Download options (e.g., timeout)
 * @returns {Promise<string>} Path to downloaded file
 */
export async function downloadHfFile(filePath, outputPath, options = {}) {
  const timer = logger.timeOperation("hf_file_download");
  const timeout =
    options.timeout || parseInt(process.env.DOWNLOAD_TIMEOUT_MS || "120000");
  const maxFileSize =
    parseInt(process.env.MAX_FILE_SIZE_MB || "50") * 1024 * 1024;

  try {
    logger.info("Starting Hugging Face download", {
      filePath,
      outputPath,
      timeout,
    });

    // Ensure parent directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info("Created directory", { dir });
    }

    // Use axios with streaming to handle large files
    const response = await pRetry(
      () =>
        axios.get(
          `https://huggingface.co/datasets/${datasetOwner}/${datasetName}/resolve/main/${encodeURIComponent(
            filePath
          )}`,
          {
            responseType: "stream",
            timeout,
            headers: { Authorization: `Bearer ${token}` },
          }
        ),
      {
        retries: 3,
        onFailedAttempt: (error) => {
          logger.warn("Download attempt failed, retrying", {
            filePath,
            attempt: error.attemptNumber,
            error: error.message,
          });
        },
      }
    );

    // Check file size
    const contentLength = response.headers["content-length"];
    if (contentLength && parseInt(contentLength) > maxFileSize) {
      logger.error("File exceeds maximum size", {
        filePath,
        size: contentLength,
      });
      throw new Error(
        `File size (${(parseInt(contentLength) / 1024 / 1024).toFixed(
          2
        )}MB) exceeds limit of ${maxFileSize / 1024 / 1024}MB`
      );
    }

    // Stream file to disk
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", () => {
        const fileStats = fs.statSync(outputPath);
        timer.end(true, { filePath, fileSize: fileStats.size });
        logger.info("Download completed successfully", {
          filePath,
          outputPath,
          fileSize: fileStats.size,
        });
        resolve(outputPath);
      });
      writer.on("error", (err) => {
        timer.end(false, { error: err.message });
        logger.error("Download failed", {
          filePath,
          error: err.message,
          stack: err.stack,
        });
        reject(new Error(`Download failed: ${err.message}`));
      });
    });

    return outputPath;
  } catch (error) {
    timer.end(false, { error: error.message });
    logger.error("Download failed", {
      filePath,
      error: error.message,
      stack: error.stack,
    });
    throw new Error(`Download failed: ${error.message}`);
  }
}

/**
 * Get direct download URL for a file
 * @param {string} filePath - Dataset file path
 * @returns {string} Download URL
 */
export function getFileDownloadUrl(filePath) {
  if (!filePath) {
    logger.error("File path required for download URL", { filePath });
    throw new Error("File path is required");
  }
  const encodedPath = encodeURIComponent(filePath);
  return `https://huggingface.co/datasets/${datasetOwner}/${datasetName}/resolve/main/${encodedPath}`;
}

/**
 * Upload a file to Hugging Face dataset
 * @param {string} localFilePath - Local file path
 * @param {string} datasetPath - Dataset path
 * @param {string} commitMessage - Commit message
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToDataset(
  localFilePath,
  datasetPath,
  commitMessage = "Add new book"
) {
  const timer = logger.timeOperation("hf_upload");
  if (!token) {
    logger.error("HF_API_TOKEN required for uploads", {
      localFilePath,
      datasetPath,
    });
    throw new Error("HF_API_TOKEN required for uploads");
  }

  try {
    logger.info("Starting upload to Hugging Face dataset", {
      localFilePath,
      datasetPath,
      commitMessage,
    });

    const result = await hub.uploadFiles({
      repo: getRepoDesignation(),
      accessToken: token,
      files: [
        {
          path: datasetPath,
          content: new Blob([fs.readFileSync(localFilePath)]),
        },
      ],
      commitMessage,
    });

    const fileStats = fs.statSync(localFilePath);
    timer.end(true, { datasetPath, fileSize: fileStats.size });
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
      stack: error.stack,
    });
    throw new Error(`Upload failed: ${error.message}`);
  }
}
