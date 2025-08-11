#!/usr/bin/env node

/**
 * MongoDB Population Script
 * Loads all books from Hugging Face dataset into MongoDB Atlas
 * Run this once to populate your empty cluster
 */

import mongoose from 'mongoose';
import BookCache from '../models/bookCacheModel.js';
import BookService from '../services/bookService.js';
import connectDB from '../config/database.js';
import { logger } from '../logs/logger.js';

class MongoDBPopulator {
  constructor() {
    this.bookService = new BookService();
    this.batchSize = 50; // Process in batches to avoid memory issues
    this.stats = {
      total: 0,
      processed: 0,
      success: 0,
      errors: 0,
      duplicates: 0
    };
  }

  /**
   * Main population function
   */
  async populate() {
    try {
      console.log('🚀 Starting MongoDB population...');
      console.log('📊 Connecting to database...');
      
      // Connect to MongoDB
      await connectDB();
      
      console.log('✅ Database connected successfully!');
      console.log('📚 Fetching books from Hugging Face dataset...');
      
      // Get all books from Hugging Face
      const allBooks = await this.bookService._listMyDatasetFiles();
      this.stats.total = allBooks.length;
      
      console.log(`📈 Found ${this.stats.total} books to process`);
      
      // Clear existing collection (optional - remove if you want to keep existing data)
      const existingCount = await BookCache.countDocuments();
      if (existingCount > 0) {
        console.log(`🗑️  Found ${existingCount} existing documents`);
        const choice = await this.askUserChoice();
        if (choice === 'clear') {
          await BookCache.deleteMany({});
          console.log('✅ Cleared existing collection');
        }
      }
      
      // Process books in batches
      await this.processBooksInBatches(allBooks);
      
      // Show final stats
      this.showFinalStats();
      
    } catch (error) {
      logger.error('Population failed', { error: error.message });
      console.error('❌ Population failed:', error.message);
      throw error;
    } finally {
      // Close database connection
      await mongoose.connection.close();
      console.log('🔌 Database connection closed');
    }
  }

  /**
   * Process books in batches for better performance
   */
  async processBooksInBatches(books) {
    const batches = this.createBatches(books, this.batchSize);
    
    console.log(`🔄 Processing ${batches.length} batches of ${this.batchSize} books each...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`\n📦 Processing batch ${i + 1}/${batches.length} (${batch.length} books)...`);
      
      await this.processBatch(batch);
      
      // Show progress
      const progress = ((i + 1) / batches.length * 100).toFixed(1);
      console.log(`✅ Batch ${i + 1} completed | Progress: ${progress}%`);
    }
  }

  /**
   * Process a single batch of books
   */
  async processBatch(books) {
    const promises = books.map(book => this.processBook(book));
    await Promise.all(promises);
  }

  /**
   * Process a single book
   */
  async processBook(book) {
    try {
      this.stats.processed++;
      
      // Generate unique book ID using the same logic as BookService
      const bookId = this.bookService._generateBookId(book);
      
      // Check if book already exists
      const existing = await BookCache.findOne({ bookId });
      if (existing) {
        this.stats.duplicates++;
        return;
      }
      
      // Create new book cache entry
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
      
      // Save to database
      const bookCache = new BookCache(bookCacheData);
      await bookCache.save();
      
      this.stats.success++;
      
      // Log every 10th book for progress tracking
      if (this.stats.processed % 10 === 0) {
        console.log(`  📚 Processed ${this.stats.processed}/${this.stats.total} books (${this.stats.success} saved)`);
      }
      
    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to process book', {
        book: book.title,
        error: error.message
      });
      console.error(`❌ Failed to save: ${book.title} - ${error.message}`);
    }
  }

  /**
   * Create batches from array
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Ask user what to do with existing data
   */
  async askUserChoice() {
    // For automation, we'll default to keeping existing data
    // In interactive mode, you could use readline to ask the user
    console.log('ℹ️  Keeping existing data and adding new books');
    return 'keep';
  }

  /**
   * Show final statistics
   */
  showFinalStats() {
    console.log('\n🎉 Population completed!');
    console.log('📊 Final Statistics:');
    console.log(`   📚 Total books found: ${this.stats.total}`);
    console.log(`   ✅ Successfully saved: ${this.stats.success}`);
    console.log(`   🔄 Duplicates skipped: ${this.stats.duplicates}`);
    console.log(`   ❌ Errors: ${this.stats.errors}`);
    console.log(`   📈 Success rate: ${((this.stats.success / this.stats.total) * 100).toFixed(1)}%`);
    
    if (this.stats.errors > 0) {
      console.log('⚠️  Check logs for error details');
    }
  }

  /**
   * Verify the population by showing sample data
   */
  async verify() {
    try {
      console.log('\n🔍 Verifying population...');
      
      await connectDB();
      
      const totalDocs = await BookCache.countDocuments();
      console.log(`📊 Total documents in collection: ${totalDocs}`);
      
      // Show sample documents from each category
      const categories = await BookCache.distinct('category');
      console.log(`📂 Categories found: ${categories.join(', ')}`);
      
      for (const category of categories.slice(0, 3)) { // Show first 3 categories
        const sample = await BookCache.findOne({ category });
        console.log(`\n📖 Sample from ${category}:`);
        console.log(`   Title: ${sample.title}`);
        console.log(`   ID: ${sample.bookId}`);
        console.log(`   Multi-volume: ${sample.isMultiVolume}`);
      }
      
    } catch (error) {
      console.error('❌ Verification failed:', error.message);
    } finally {
      await mongoose.connection.close();
    }
  }
}

// Script execution
async function main() {
  const populator = new MongoDBPopulator();
  
  // Check command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--verify')) {
    await populator.verify();
  } else {
    await populator.populate();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Script failed:', error.message);
    process.exit(1);
  });
}

export default MongoDBPopulator;
