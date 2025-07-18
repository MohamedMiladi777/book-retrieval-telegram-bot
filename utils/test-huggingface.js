import { listDatasetFiles, searchBooks } from "./hugging-face-utils.js";
import { logger } from "../logs/logger.js";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

async function testCorrectedHuggingFace() {
  const timer = logger.timeOperation("test_corrected_hf");

  try {
    console.log("\n📚 Testing corrected Hugging Face dataset structure...\n");

    // Test 1: List all PDF files with new structure
    console.log("1️⃣ Testing listDatasetFiles with correct path structure...");
    const files = await listDatasetFiles();
    
    console.log(`✅ Found ${files.length} PDF files`);
    console.log("📋 Sample files with metadata:");
    files.slice(0, 3).forEach((file, index) => {
      console.log(`   ${index + 1}. ${file.title}`);
      console.log(`      Author: ${file.author}`);
      console.log(`      Category: ${file.category}`);
      console.log(`      Path: ${file.path}`);
      console.log(`      Download URL: ${file.downloadUrl.substring(0, 80)}...`);
      console.log("");
    });

    // Test 2: Search by Arabic category
    console.log("2️⃣ Testing search by category 'علوم القرآن'...");
    const quranBooks = await searchBooks({ category: "علوم القرآن" }, 5);
    
    console.log(`✅ Found ${quranBooks.length} books in 'علوم القرآن' category`);
    quranBooks.slice(0, 2).forEach((book, index) => {
      console.log(`   ${index + 1}. ${book.title} by ${book.author}`);
    });

    // Test 3: Search by title
    console.log("\n3️⃣ Testing search by title containing 'القرآن'...");
    const titleBooks = await searchBooks({ title: "القرآن" }, 3);
    
    console.log(`✅ Found ${titleBooks.length} books with 'القرآن' in title`);
    titleBooks.forEach((book, index) => {
      console.log(`   ${index + 1}. ${book.title}`);
    });

    timer.end(true, { 
      totalFiles: files.length, 
      quranBooks: quranBooks.length,
      titleBooks: titleBooks.length 
    });
    
    console.log("\n🎉 All tests completed successfully!");
    
    return { 
      totalFiles: files.length, 
      categories: [...new Set(files.map(f => f.category))].length 
    };
    
  } catch (error) {
    timer.end(false, { error: error.message });
    console.error("\n❌ Test failed:", error.message);
    throw error;
  }
}

// Run the test
testCorrectedHuggingFace()
  .then((results) => {
    console.log("\n📊 Test Results:", results);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Test script failed:", error.message);
    process.exit(1);
  });