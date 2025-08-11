import config from "./configService.js";
import errorHandler from "./errorService.js";
import { logger } from "../logs/logger.js";
import BookCache from '../models/bookCacheModel.js';
import {
  listDatasetFiles,
  searchBooks as searchHfBooks,
} from "../utils/hugging-face-utils.js";

import { HuggingFaceError } from "./errorService.js";

/**
 * Optimized BookService that uses MongoDB first, then falls back to Hugging Face
 * This provides much faster response times by caching data locally
 */
class BookServiceOptimized {
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

    // Still keep in-memory mapping for backward compatibility
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
    // Clean up old cache entries and sync with database
    setInterval(async () => {
      try {
        await this.cleanupCache();
      } catch (error) {
        this.logger.error('Cache cleanup failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // Run every hour
  }

  /**
   * Cleanup old cache entries and update database
   */
  async cleanupCache() {
    this.logger.info("Starting cache cleanup...");
    
    // Clear in-memory mappings
    this.bookMappings.clear();
    
    // Update lastAccessed for recently accessed books in database
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await BookCache.updateMany(
      { lastAccessed: { $gte: oneHourAgo } },
      { lastAccessed: new Date() }
    );
    
    this.logger.info("Cache cleanup completed");
  }

  /**
   * OPTIMIZED: Get books by category from MongoDB first
   */
  async getBooksByCategory(category) {
    try {
      this.logger.info(`Getting books for category: ${category}`);
      
      // First, try to get from MongoDB (much faster!)
      const booksFromDB = await BookCache.find({ category }).lean();
      
      if (booksFromDB && booksFromDB.length > 0) {
        this.logger.info(`Found ${booksFromDB.length} books in database for ${category}`);
        
        // Update lastAccessed for these books
        await BookCache.updateMany(
          { category },
          { lastAccessed: new Date() }
        );
        
        // Convert to the format expected by the rest of the app
        return booksFromDB.map(book => this.formatBookFromDB(book));
      }
      
      // Fallback: if not in database, fetch from Hugging Face and cache
      this.logger.warn(`No books found in database for ${category}, fetching from Hugging Face...`);
      return await this.getBooksByCategoryFromHF(category);
      
    } catch (error) {
      this.logger.error('Error getting books by category', {
        category,
        error: error.message
      });
      throw new HuggingFaceError(`Failed to get books for category ${category}`, error);
    }
  }

  /**
   * OPTIMIZED: Search books in MongoDB first
   */
  async searchBooks(query = {}) {
    try {
      const { category, text, isMultiVolume } = query;
      this.logger.info('Searching books with optimized search', { query });

      // Build MongoDB query
      const dbQuery = {};
      if (category) dbQuery.category = category;
      if (isMultiVolume !== undefined) dbQuery.isMultiVolume = isMultiVolume;

      // Add text search if provided
      let books;
      if (text) {
        books = await BookCache.find({
          ...dbQuery,
          $text: { $search: text }
        }).lean();
      } else {
        books = await BookCache.find(dbQuery).lean();
      }

      if (books && books.length > 0) {
        this.logger.info(`Found ${books.length} books in database`);
        
        // Update lastAccessed
        const bookIds = books.map(b => b._id);
        await BookCache.updateMany(
          { _id: { $in: bookIds } },
          { lastAccessed: new Date() }
        );
        
        return books.map(book => this.formatBookFromDB(book));
      }

      // Fallback to Hugging Face search
      this.logger.warn('No books found in database, falling back to Hugging Face search');
      return await this.searchBooksFromHF(query);

    } catch (error) {
      this.logger.error('Search failed', { query, error: error.message });
      throw new HuggingFaceError('Search operation failed', error);
    }
  }

  /**
   * Get a specific book by ID from database first
   */
  async getBookById(bookId) {
    try {
      // Check in-memory cache first
      if (this.bookMappings.has(bookId)) {
        return this.bookMappings.get(bookId);
      }

      // Check MongoDB
      const bookFromDB = await BookCache.findOne({ bookId }).lean();
      if (bookFromDB) {
        const formattedBook = this.formatBookFromDB(bookFromDB);
        
        // Update lastAccessed
        await BookCache.updateOne(
          { bookId },
          { lastAccessed: new Date() }
        );
        
        // Cache in memory for quick access
        this.bookMappings.set(bookId, formattedBook);
        return formattedBook;
      }

      // Fallback: search in Hugging Face data
      this.logger.warn(`Book ${bookId} not found in database, searching Hugging Face...`);
      const allBooks = await this._listMyDatasetFiles();
      const book = allBooks.find(b => this._generateBookId(b) === bookId);
      
      if (book) {
        // Cache the book in database for future use
        await this.cacheBookInDB(book);
        this.bookMappings.set(bookId, book);
      }
      
      return book;

    } catch (error) {
      this.logger.error('Error getting book by ID', { bookId, error: error.message });
      throw error;
    }
  }

  /**
   * Helper: Cache a book from Hugging Face into database
   */
  async cacheBookInDB(book) {
    try {
      const bookId = this._generateBookId(book);
      
      // Check if already exists
      const existing = await BookCache.findOne({ bookId });
      if (existing) return;
      
      const bookCacheData = {
        bookId,
        category: book.category,
        title: book.title,
        filePath: book.filePath,
        downloadUrl: book.downloadUrl,
        isMultiVolume: book.isMultiVolume,
        author: book.author,
        bookCollection: book.collection,
        volume: book.volume,
        size: book.size || 0,
        lastModified: book.lastModified ? new Date(book.lastModified) : null,
        lastAccessed: new Date()
      };
      
      const bookCache = new BookCache(bookCacheData);
      await bookCache.save();
      
      this.logger.info('Book cached in database', { bookId, title: book.title });
      
    } catch (error) {
      this.logger.error('Failed to cache book in database', { 
        book: book.title, 
        error: error.message 
      });
    }
  }

  /**
   * Helper: Format book from database to match expected format
   */
  formatBookFromDB(dbBook) {
    return {
      category: dbBook.category,
      title: dbBook.title,
      filePath: dbBook.filePath,
      downloadUrl: dbBook.downloadUrl,
      isMultiVolume: dbBook.isMultiVolume,
      author: dbBook.author,
      collection: dbBook.bookCollection,
      volume: dbBook.volume,
      size: dbBook.size,
      lastModified: dbBook.lastModified,
      // Add database-specific info
      _id: dbBook._id,
      lastAccessed: dbBook.lastAccessed,
      createdAt: dbBook.createdAt,
      updatedAt: dbBook.updatedAt
    };
  }

  /**
   * Fallback: Original Hugging Face category search
   */
  async getBooksByCategoryFromHF(category) {
    const files = await this._listMyDatasetFiles();
    const categoryBooks = files.filter(book => book.category === category);
    
    // Cache these books in database for future use
    for (const book of categoryBooks) {
      await this.cacheBookInDB(book);
    }
    
    return categoryBooks;
  }

  /**
   * Fallback: Original Hugging Face search
   */
  async searchBooksFromHF(query = {}) {
    const allBooks = await this._listMyDatasetFiles();
    let filteredBooks = allBooks;

    if (query.category) {
      filteredBooks = filteredBooks.filter(book => book.category === query.category);
    }

    if (query.isMultiVolume !== undefined) {
      filteredBooks = filteredBooks.filter(book => book.isMultiVolume === query.isMultiVolume);
    }

    if (query.text) {
      const searchText = query.text.toLowerCase();
      filteredBooks = filteredBooks.filter(book =>
        book.title.toLowerCase().includes(searchText) ||
        (book.author && book.author.toLowerCase().includes(searchText))
      );
    }

    // Cache search results
    for (const book of filteredBooks.slice(0, 50)) { // Cache first 50 results
      await this.cacheBookInDB(book);
    }

    return filteredBooks;
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats() {
    try {
      const totalBooks = await BookCache.countDocuments();
      const categories = await BookCache.distinct('category');
      const multiVolumeCount = await BookCache.countDocuments({ isMultiVolume: true });
      
      const categoryStats = {};
      for (const category of categories) {
        categoryStats[category] = await BookCache.countDocuments({ category });
      }
      
      return {
        totalBooks,
        categories: categories.length,
        multiVolumeBooks: multiVolumeCount,
        singleVolumeBooks: totalBooks - multiVolumeCount,
        categoryBreakdown: categoryStats
      };
    } catch (error) {
      this.logger.error('Failed to get database stats', { error: error.message });
      throw error;
    }
  }

  // Keep all original methods for backward compatibility
  async _listMyDatasetFiles() {
    try {
      const files = await listDatasetFiles(
        this.config.huggingFace.token,
        this.config.huggingFace.repoId
      );

      this.logger.info(`Found ${files.length} total files in dataset`);

      const books = files.filter(file => file.path.endsWith(".pdf"));
      this.logger.info(`Found ${books.length} PDF files`);

      const processedBooks = books.map(book => this.processBook(book));
      this.logger.info(`Processed ${processedBooks.length} books`);

      return processedBooks;
    } catch (error) {
      this.logger.error("Failed to list dataset files", { error: error.message });
      throw new HuggingFaceError("Failed to retrieve dataset files", error);
    }
  }

  // Keep all other original methods unchanged...
  processBook(book) {
    const pathParts = book.path.split("/");
    const category = pathParts[0];
    const fileName = pathParts[pathParts.length - 1];
    const title = fileName.replace(".pdf", "");

    const processedBook = {
      category,
      title,
      filePath: book.path,
      downloadUrl: `https://huggingface.co/datasets/${this.config.huggingFace.repoId}/resolve/main/${book.path}`,
      isMultiVolume: this.detectMultiVolume(title),
      author: this.extractAuthor(title),
      collection: this.extractCollection(title),
      volume: this.extractVolume(title),
      size: book.size,
      lastModified: book.lastModified,
    };

    return processedBook;
  }

  _generateBookId(book) {
    const hash = this.simpleHash(book.filePath);
    return `bk_${hash.toString(36).substring(0, 8)}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  // Keep all other utility methods...
  detectMultiVolume(title) {
    const volumePatterns = [/_\d+$/, /\d+$/, /الجزء\s*\d+/, /ج\d+/, /المجلد\s*\d+/];
    return volumePatterns.some(pattern => pattern.test(title));
  }

  extractAuthor(title) {
    return null; // Implement if you have author patterns
  }

  extractCollection(title) {
    return null; // Implement if you have collection patterns
  }

  extractVolume(title) {
    const volumeMatch = title.match(/_(\d+)$/);
    return volumeMatch ? parseInt(volumeMatch[1]) : null;
  }
}

export default BookServiceOptimized;
