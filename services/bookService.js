import config from "./configService.js";
import errorHandler from "./errorService.js";
import { logger } from "../logs/logger.js";
import {
  listDatasetFiles,
  searchBooks as searchHfBooks,
} from "../utils/hugging-face-utils.js";

import { HuggingFaceError } from "./errorService.js";

class BookService {
  constructor(dependencies = {}) {
    //destructure dependencies with defaults
    const {
      config: configService = config,
      logger: loggerService = logger,
      errorHandler: errorService = errorHandler,
    } = dependencies;

    this.config = configService;
    this.logger = loggerService;
    this.errorHandler = errorService;

    this.categories = [
      "أدب",
      "تاريخ و تراجم",
      "تفسير",
      "حديث",
      "زهد و رقائق",
      "سيرة",
      "عقيدة",
      "علوم_أخرى",
      "فقه",
      "قراءات",
    ];

    if (!process.env.HF_API_TOKEN) {
      console.log("Token is required");
    }
  }

  /**
   * Get all available categories
   * @returns {Promise<Array>} Array of category objects
   */
  async getCategories() {
    // TODO: Implementation
    try {
      this.logger.info("Fetching categories from athari-library dataset");
      // Return my categories

      const categoriesWithCount = this.categories.map((category) => ({
        name: category,
        count: null, //later use
      }));
      this.logger.info(`Returning ${categoriesWithCount.length} categories`);
      return categoriesWithCount;
    } catch (error) {
      this.logger.error("Error in fetching categories", {
        error: error.message,
      });
      throw new HuggingFaceError("Failed to fetch categories");
    }
  }

  /**
   * List all PDF files from your dataset
   * @returns {Promise<Array>} Array of book objects with metadata
   */
  async _listMyDatasetFiles() {
    try {
      this.logger.info("Fetching files from athari-library dataset");

      // Step 1: Import what you need
      const { listFiles } = await import("@huggingface/hub");
      // Step 2: Create empty array for results
      let files = [];
      // Step 3: Iterate through files (I'll give you this part)
      for await (const fileInfo of listFiles({
        repo: `datasets/${this.config.huggingFace.datasetOwner}/${this.config.huggingFace.datasetName}`,
        accessToken: this.config.huggingFace.apiToken,
        recursive: true,
      })) {
        // Step 4: Your filtering logic goes here
        // Hint: Check if fileInfo.path ends with .pdf AND contains '/pdf/'
        if (fileInfo.path.endsWith(".pdf") && fileInfo.path.includes("/pdf/")) {
          // Step 5: Your metadata extraction goes here
          // Hint: Use your _extractMetadataFromPath() method
          const metadata = this._extractMetadataFromPath(fileInfo.path);

          // Step 6: Create file object with metadata and download URL
          const downloadUrl = `https://huggingface.co/datasets/${
            this.config.huggingFace.datasetOwner
          }/${
            this.config.huggingFace.datasetName
          }/resolve/main/${encodeURIComponent(fileInfo.path)}`;
          files.push({
            ...metadata,
            downloadUrl,
            size: fileInfo.size || 0,
            lastModified: fileInfo.lastCommit?.date,
          });
        }
        // Hint: Combine metadata with downloadUrl
      }

      // Step 7: Log and return results
      this.logger.info(`Found ${files.length} PDF files in dataset`);
      return files;
    } catch (error) {
      // Step 8: Your error handling
      this.logger.error("Error in fetching dataset files", {
        error: error.message,
      });
      throw new this.errorHandler.HuggingFaceError(
        "Failed to fetch dataset files",
        error
      );
    }
  }

  /**
   * Extract metadata from your file path
   * @param {string} filePath - e.g., "تفسير/pdf/تفسير_الطبري/تفسير_الطبري_1.pdf"
   * @returns {Object} - {category, title, author, volume, isMultiVolume}
   */
  _extractMetadataFromPath(filePath) {
    // Step 1: Split the path and extract basic info
    const pathParts = filePath.split("/");
    const category = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];

    // Step 2: Remove .pdf extension

    const nameWithoutExt = fileName.replace(".pdf", "");

    // Step 3: Check if it's multi-volume (ends with number)
    const volumeMatch = nameWithoutExt.match(/_(\d+)$/);
    const isMultiVolume = volumeMatch !== null;

    let title, author, volume;

    if (isMultiVolume) {
      volume = parseInt(volumeMatch[1]);
      title = nameWithoutExt.replace(/_\d+$/, "").replace(/_/g, " ");
      author = null; // Books do not have named authurs yet, they shall be embedded soon insha'Allah
    } else {
      // Single volume: "الناسخ_والمنسوخ _القاسم_بن_سلام"
      // Your task: How do you split title from author?
      // Hint: You need a rule to determine where title ends and author begins
      title = nameWithoutExt.replace(/_/g, " ");
      author = null;
    }

    return {
      category,
      title: title.trim(),
      author: author ? author.trim() : null,
      volume,
      isMultiVolume,
      filePath,
    };
  }

  /**
   * Search books by criteria
   * @param {Object} query - Search criteria
   * @param {string} query.category - Category name (optional)
   * @param {string} query.title - Title search (optional)
   * @param {string} query.author - Author search (optional)
   * @returns {Promise<Array>} Array of book objects
   */
  async searchBooks(query = {}) {
    // TODO: Implementation
  }

  /**
   * Get book metadata by ID
   * @param {string} bookId - Book identifier
   * @returns {Promise<Object>} Book metadata object
   */
  async getBookMetadata(bookId) {
    // TODO: Implementation
  }

  /**
   * Download book and send to Telegram user
   * @param {string} bookId - Book identifier
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async downloadBook(bookId, ctx) {
    // TODO: Implementation
  }

  /**
   * Get book metadata by ID
   * @param {string} bookId - Book identifier
   * @returns {Promise<Object>} Book metadata object
   */

  async downloadBook(bookId, ctx) {}
}

export default BookService;
