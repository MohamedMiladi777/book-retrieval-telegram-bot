import {
  listDatasetFiles,
  searchBooks,
  getFileDownloadUrl,
} from "../utils/hugging-face-utils.js";
import { logger } from "../logs/logger.js";

async function testHfClient() {
  try {
    logger.info("Testing Hugging Face client...");

    // Test 1: List files
    console.log("1. Testing file listing...");
    const files = await listDatasetFiles();
    console.log(`Found ${files.length} PDF files`);
    console.log(
      "Sample files:",
      files.slice(0, 3).map((f) => f.name)
    );

    // Test 2: Search books
    console.log("\n2. Testing search...");
    const searchResults = await searchBooks({ category: "aqeedah" }, 5);
    console.log(`Search found ${searchResults.length} results`);

    // Test 3: Generate download URL
    if (files.length > 0) {
      console.log("\n3. Testing URL generation...");
      const url = getFileDownloadUrl(files[0].path);
      console.log("Sample download URL:", url);
    }

    logger.info("All tests passed!");
  } catch (error) {
    logger.error("Test failed:", { error: error.message });
    process.exit(1);
  }
}

testHfClient();
