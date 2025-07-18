/**
 * Test BookService Implementation
 */

import BookService from './services/bookService.js'; // Adjust the path as needed

async function testBookService() {
  console.log('🧪 Testing BookService...\n');
  
  try {
    // Step 1: Create BookService instance
    const bookService = new BookService();
    
    // Step 2: Test getCategories()
    console.log('1️⃣ Testing getCategories():');
    const categories = await bookService.getCategories();
    console.log(`   ✅ Found ${categories.length} categories`);
    categories.forEach(cat => console.log(`   📚 ${cat.name}`));
    
    // Step 3: Test _listMyDatasetFiles() (first 5 books)
    console.log('\n2️⃣ Testing _listMyDatasetFiles():');
    const files = await bookService._listMyDatasetFiles();
    console.log(`   ✅ Found ${files.length} total books`);
    
    console.log('\n📖 Sample books:');
    files.slice(0, 5).forEach((book, index) => {
      console.log(`   ${index + 1}. ${book.title}`);
      console.log(`      Category: ${book.category}`);
      console.log(`      Author: ${book.author || 'Unknown'}`);
      console.log(`      Multi-volume: ${book.isMultiVolume ? 'Yes' : 'No'}`);
      if (book.volume) console.log(`      Volume: ${book.volume}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testBookService();