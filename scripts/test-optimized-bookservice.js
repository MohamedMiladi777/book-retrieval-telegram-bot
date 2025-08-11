#!/usr/bin/env node

/**
 * Test the optimized BookService with MongoDB integration
 */

import connectDB from '../config/database.js';
import BookServiceOptimized from '../services/bookServiceOptimized.js';
import { logger } from '../logs/logger.js';

async function testOptimizedBookService() {
  try {
    console.log('🚀 Testing Optimized BookService...');
    
    // Connect to database
    await connectDB();
    console.log('✅ Database connected');
    
    // Create optimized service
    const bookService = new BookServiceOptimized();
    
    // Test 1: Get database stats
    console.log('\n📊 Database Statistics:');
    const stats = await bookService.getDatabaseStats();
    console.log(JSON.stringify(stats, null, 2));
    
    // Test 2: Get books by category (should be fast from DB)
    console.log('\n📚 Testing category search (from database):');
    const startTime = Date.now();
    const booksInCategory = await bookService.getBooksByCategory('تفسير');
    const dbTime = Date.now() - startTime;
    console.log(`Found ${booksInCategory.length} books in تفسير category`);
    console.log(`⚡ Database query took: ${dbTime}ms`);
    
    // Test 3: Search books
    console.log('\n🔍 Testing book search:');
    const searchResults = await bookService.searchBooks({ 
      category: 'حديث',
      isMultiVolume: false 
    });
    console.log(`Found ${searchResults.length} single-volume حديث books`);
    
    // Test 4: Get specific book by ID
    if (booksInCategory.length > 0) {
      console.log('\n🎯 Testing get book by ID:');
      const firstBook = booksInCategory[0];
      const bookId = bookService._generateBookId(firstBook);
      const retrievedBook = await bookService.getBookById(bookId);
      console.log(`Retrieved book: ${retrievedBook?.title}`);
    }
    
    // Test 5: Compare with original method (should be slower)
    console.log('\n⏱️  Performance comparison:');
    console.log('Database method took:', dbTime, 'ms');
    
    // Test original HF method for comparison
    const hfStartTime = Date.now();
    const hfBooks = await bookService.getBooksByCategoryFromHF('تفسير');
    const hfTime = Date.now() - hfStartTime;
    console.log('Hugging Face method took:', hfTime, 'ms');
    console.log('📈 Speed improvement:', ((hfTime / dbTime) * 100).toFixed(1) + '%');
    
    console.log('\n🎉 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    logger.error('BookService test failed', { error: error.message });
  } finally {
    process.exit(0);
  }
}

// Run test
testOptimizedBookService();
