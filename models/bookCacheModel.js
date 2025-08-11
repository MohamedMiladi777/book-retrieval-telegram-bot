import mongoose from "mongoose";

// BookCache Schema - stores book metadata for fast searches
// Replaces the in-memory bookMappings that get cleared every hour
const bookCacheSchema = new mongoose.Schema({
  // Your generated unique book ID (e.g., "bk_a7f8d2c1")
  bookId: {
    type: String,
    required: true,
    unique: true,
    maxlength: 20, // Keep it short for Telegram buttons
  },

  // Required fields - always available from your data
  category: {
    type: String,
    required: true,
  },
  
  title: {
    type: String,
    required: true,
  },
  
  filePath: {
    type: String,
    required: true,
    unique: true, // Each file should be unique
  },
  
  downloadUrl: {
    type: String,
    required: true,
  },
  
  isMultiVolume: {
    type: Boolean,
    required: true,
    default: false,
  },

  // Optional fields - might be null/undefined
  author: {
    type: String,
    default: null,
  },
  
  bookCollection: {
    type: String,
    default: null,
  },
  
  volume: {
    type: Number,
    default: null,
  },
  
  size: {
    type: Number,
    default: 0,
  },
  
  lastModified: {
    type: Date,
    default: null,
  },

  // Cache management
  lastAccessed: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  collection: 'bookcaches' // Explicitly set collection name to avoid typos
});

// Add indexes for better query performance
bookCacheSchema.index({ category: 1 }); // For category filtering
bookCacheSchema.index({ bookId: 1 }, { unique: true }); // Ensure uniqueness
bookCacheSchema.index({ title: 'text', author: 'text' }); // For text search
bookCacheSchema.index({ lastAccessed: -1 }); // For cache management

const BookCache = mongoose.model("BookCache", bookCacheSchema);

export default BookCache;
