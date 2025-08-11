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
    this.seriesMappings = new Map();
    this.userRequests = new Map();

    this.categories = [
      "سيرة",
      "تفسير",
      "حديث",
      "زهد و رقائق",
      "عقيدة",
      "علوم_أخرى",
      "فقه",
      "قراءات",
    ];

    // In-memory mapping of book IDs to book objects
    this.bookMappings = new Map();

    if (!process.env.HF_API_TOKEN) {
      console.log("Token is required");
    }

    // Initialize cleanup timer (run once)
    this.initializeCleanup();
  }

  /**
   * Initialize memory cleanup timer
   */
  initializeCleanup() {
    // Clear mappings every hour to prevent memory leaks
    setInterval(() => {
      this.bookMappings.clear();
      this.seriesMappings.clear();
      this.userRequests.clear();
      this.logger.info("Cleared old mappings for memory management");
    }, 3600000); // 1 hour
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
   * @param {string} filePath - e.g., "تفسير/pdf/تفسير_الطبري/تفسير_الطبري_1.pdf" or "تفسير/pdf/تفسير_مكة/book1/book1_1.pdf"
   * @returns {Object} - {category, collection, title, author, volume, isMultiVolume}
   */
  _extractMetadataFromPath(filePath) {
    // Step 1: Split the path and extract basic info
    const pathParts = filePath.split("/");
    const category = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];

    // Step 2: Detect collection structure
    // The stcuture for a collection is category/pdf/collection/bookFolder/file.pdf
    let collection = null;
    let bookFolder = null;

    if (pathParts.length === 5) {
      collection = pathParts[2];
      bookFolder = pathParts[3];
    }
    // The normal structure is category/pdf/bookFolder/file.pdf
    else if (pathParts.length === 4) {
      collection = pathParts[1];
      bookFolder = pathParts[2];
    }
    // Step 3: Remove .pdf extension

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
      collection: collection ? collection.replace(/_/g, " ") : null,
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
    try {
      this.logger.info("Searching books with criteria", { query });

      // Step 1: Get all books from dataset
      // Your task: How do you get all books?
      const allBooks = await this._listMyDatasetFiles();

      // Step 2: Filter by category (if provided)
      // Your task: How do you filter books where book.category === query.category?
      const filteredBooks = allBooks.filter((book) => {
        if (query.category) {
          return book.category === query.category;
        }
        return true;
      });

      // Step 3: Filter by title (if provided) - partial match
      // Your task: How do you filter books where book.title contains query.title?
      const filteredByTitle = filteredBooks.filter((book) => {
        if (query.title) {
          return book.title.toLowerCase().includes(query.title.toLowerCase());
        }
        return true;
      });

      // Step 4: hFilter by author (if provided) - partial match
      // Your task: How do you filter books where book.author contains query.author?
      const filteredByAuthor = filteredByTitle.filter((book) => {
        if (query.author) {
          return book.author
            ? book.author.toLowerCase().includes(query.author.toLowerCase())
            : false;
        }
        return true;
      });

      // Step 5: Add unique IDs to books and return results
      const booksWithIds = filteredByAuthor.map((book) => {
        const id = this._generateBookId(book);
        // Store mapping for later retrieval
        this._storeBookMapping(id, book);
        return {
          ...book,
          id,
        };
      });

      this.logger.info(`Found ${booksWithIds.length} matching books`);
      return booksWithIds;
    } catch (error) {
      this.logger.error("Search failed", { error: error.message, query });
      throw new HuggingFaceError("Failed to search books");
    }
  }

  /**
   * Generate unique ID for a book (short for Telegram buttons)
   * @param {Object} book - Book object
   * @returns {string} Unique book ID (max 64 bytes for Telegram)
   */
  _generateBookId(book) {
    // Create a short unique ID using just the file path hash
    // This ensures uniqueness while staying under Telegram's 64-byte limit

    const rawId = `${book.category}_${book.title}_${book.volume || "single"}`;
    const hash = this._simpleHash(rawId);

    // Create a short ID: just hash with prefix
    const shortId = `bk_${hash}`;

    return shortId;
  }

  //method for debugging:
  async debugDatasetStructure() {
    try {
      const files = await this._listMyDatasetFiles();
      console.log("=== DATASET STRUCTURE DEBUG ===");
      console.log("Total files found:", files.length);

      // Show first 10 files with their paths
      files.slice(0, 10).forEach((file, index) => {
        console.log(`${index + 1}. ${file.filePath}`);
        console.log(`   URL: ${file.downloadUrl}`);
      });

      // Show files from سيرة category specifically
      const seeraFiles = files.filter((f) => f.category === "سيرة");
      console.log("\n=== SIRA CATEGORY FILES ===");
      seeraFiles.forEach((file) => {
        console.log(`- ${file.filePath}`);
        console.log(`  URL: ${file.downloadUrl}`);
      });
    } catch (error) {
      console.error("Debug error:", error);
    }
  }

  /**
   * Simple hash function for creating short unique IDs
   * @param {string} str - String to hash
   * @returns {string} Short hash
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Convert to positive number and then to base36 for shorter string
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Store book ID to book object mapping
   * @param {string} id - Book ID
   * @param {Object} book - Book object
   */
  _storeBookMapping(id, book) {
    this.bookMappings.set(id, book);
  }

  /**
   * Get book object by ID
   * @param {string} id - Book ID
   * @returns {Object|null} Book object or null if not found
   */
  getBookById(id) {
    return this.bookMappings.get(id) || null;
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
   * Store series ID to series title mapping
   * @param {string} seriesId - Short series ID (like "sr_a7b3c9d2")
   * @param {string} seriesTitle - Full series title
   */
  storeSeriesMapping(seriesId, seriesTitle) {
    this.seriesMappings.set(seriesId, seriesTitle);
  }

  /**
   * Get series title by ID
   * @param {string} seriesId - Short series ID
   * @returns {string|null} Series title or null if not found
   */
  getSeriesByID(seriesId) {
    return this.seriesMappings.get(seriesId) || null;
  }

  /**
   * Download book and send to Telegram user
   * @param {string} bookId - Book identifier
   * @param {Object} ctx - Telegram context
   * @returns {Promise<void>}
   */
  async downloadBook(bookId, ctx) {
    try {
      // Get book from mapping
      const book = this.getBookById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      // Check file size limits
      const maxSize = 50 * 1024 * 1024; // 50MB Telegram limit
      if (book.size && book.size > maxSize) {
        // Send download link for large files
        return await ctx.reply(
          `📁 File too large for direct download.\n📖 ${book.title}\n\n🔗 Click to download:`,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: "📥 Download PDF", url: book.downloadUrl }
              ]]
            }
          }
        );
      }

      // Send file directly
      await ctx.replyWithDocument(book.downloadUrl, {
        caption: `📖 ${book.title}${book.author ? `\n✍️ ${book.author}` : ''}${book.category ? `\n📚 ${book.category}` : ''}`
      });

      this.logger.info('Book download successful', {
        bookId,
        title: book.title,
        userId: ctx.from.id
      });

    } catch (error) {
      this.logger.error('Book download failed', {
        bookId,
        error: error.message,
        userId: ctx.from.id
      });
      
      await ctx.reply('❌ Download failed. Please try again later.');
      throw error;
    }
  }

  /**
   * Get book metadata by ID
   * @param {string} bookId - Book identifier
   * @returns {Promise<Object>} Book metadata object
   */
  async getBookMetadata(bookId) {
    try {
      const book = this.getBookById(bookId);
      if (!book) {
        throw new Error(`Book not found: ${bookId}`);
      }

      return {
        id: bookId,
        title: book.title,
        author: book.author,
        category: book.category,
        collection: book.collection,
        volume: book.volume,
        isMultiVolume: book.isMultiVolume,
        size: book.size,
        downloadUrl: book.downloadUrl,
        lastModified: book.lastModified
      };
    } catch (error) {
      this.logger.error('Failed to get book metadata', {
        bookId,
        error: error.message
      });
      throw new Error(`Failed to get book metadata: ${error.message}`);
    }
  }

  /**
   * Check if user is within rate limits
   * @param {number} userId - Telegram user ID
   * @returns {boolean} - true if allowed, false if rate limited
   */

  checkRateLimit(userId) {
    try {
      const now = Date.now();
      const userHistory = this.userRequests.get(userId) || [];

      // Remove requests older than 1 minute (keep RECENT requests)
      const recentRequests = userHistory.filter((time) => now - time < 60000);

      // Check if user exceeded limit of 10 requests per minute
      if (recentRequests.length >= 10) {
        return false; // Block the user
      }

      // Add current request timestamp and save
      recentRequests.push(now);
      this.userRequests.set(userId, recentRequests);
      return true; // Allow the user
    } catch (error) {
      this.logger.error('Rate limit check failed', {
        userId,
        error: error.message
      });
      // Fail safe: allow request if rate limiting fails
      return true;
    }
  }
}

export default BookService;
