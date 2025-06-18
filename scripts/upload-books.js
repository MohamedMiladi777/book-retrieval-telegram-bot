import fs from "fs/promises"; // Imports promise-based fs for file operations
import path from "path"; // Imports path for file path handling
import { PDFDocument } from "pdf-lib"; // Imports PDFDocument for metadata extraction
import { BlobServiceClient, BlockBlobClient } from "@azure/storage-blob";
import mongoose from "mongoose"; // Imports mongoose for connection cleanup
import Book from "../models/bookModel.js"; // Fixed path to root models folder
import Category from "../models/categoryModel.js"; // Fixed path
import connectDB from "../config/database.js"; // Fixed path to root config folder
import dotenv from "dotenv"; // Imports dotenv for environment variables
import { blob } from "stream/consumers";
import { uploadFileToAzure } from "../utils/blob-storage-utils.js"; // Change from "./utils/"

dotenv.config({ path: "../.env" }); // Loads environment variables from .env

// Change: Replaced BlobServiceClient import with Azure-specific connection string setup
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
);

const containerClient = blobServiceClient.getContainerClient(
  process.env.AZURE_CONTAINER_NAME || "books"
);

// Maps Arabic categories to English for transliteration
const categoryTransliteration = {
  عقيدة: "Aqeedah",
};

function transliterateCategory(category) {
  return (
    categoryTransliteration[category] ||
    category
      .replace(/[\u0610-\u061A\u064B-\u065F]/g, "") // Remove Arabic diacritics
      .replace(/[^a-zA-Z0-9]/g, "_") // Replace non-alphanumeric with underscore
      .toLowerCase()
  );
}

async function uploadAndRegisterBooks(folderPath) {
  const azureBasePrefix = "books/"; // Sets S3 prefix for book storage

  try {
    // Connects to MongoDB
    await connectDB();
    console.log("Connected to MongoDB successfully!");

    // Defines recursive function to process folder contents
    async function processFolder(currentPath) {
      // Reads directory entries with type information
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      console.log(`Folder processed: ${currentPath}`);

      // Loops over each entry
      for (const entry of entries) {
        // Constructs full path for the entry
        const fullPath = path.join(currentPath, entry.name);
        console.log(`Processing entry: ${entry.name} at ${fullPath}`);
        // Recursively processes subfolders
        if (entry.isDirectory()) {
          await processFolder(fullPath);
          console.log(`Processed subfolder: ${entry.name}`);
        } else if (entry.name.endsWith(".pdf")) {
          // Constructs S3 key including subfolder
          const relativePath = path.relative(folderPath, fullPath);
          // Transliterates category name for S3 key
          const originalCategory = relativePath.split(path.sep)[0];
          const transliteratedCategory =
            transliterateCategory(originalCategory);
          const blobName = `${azureBasePrefix}${transliteratedCategory}/${path.basename(
            fullPath
          )}`;
          const pdfFile = entry.name;
          console.log(`Uploading PDF: ${pdfFile} as ${blobName}`);

          // Uploads PDF to Azure and gets download URL
          const downloadUrl = await uploadFileToAzure(fullPath, blobName);
          console.log(`Uploaded PDF: ${blobName}`);

          // Extracts metadata from PDF
          const pdfBytes = await fs.readFile(fullPath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const keywordsString = pdfDoc.getKeywords() || "";
          const keywords = keywordsString
            .split(/[,\s]+/)
            .map((kw) => kw.trim())
            .filter((kw) => kw);
          const seriesId =
            keywords.find((kw) => kw.startsWith("series_")) || null;

          // create category var, in the keywords, find the key that does not start
          //with "series_", or fallback with "Unkown"

          let extractedCategory =
            keywords.find((kw) => !kw.startsWith("series_")) || "Unknown";
          if (extractedCategory.includes("series_")) {
            extractedCategory = extractedCategory.split("")[0];
          }
          const metadata = {
            title: pdfDoc.getTitle() || path.basename(pdfFile, ".pdf"),
            author: pdfDoc.getAuthor() || "Unknown",
            category: extractedCategory,
            description: pdfDoc.getSubject() || "No description for now",
          };
          //console.log(`Extracted metadata for ${pdfFile}:`, metadata);
          //console.log(`Keywords for ${pdfFile}:`, keywords);
          console.log(`Extracted metadata for ${pdfFile}:`, {
            ...metadata,
            seriesId,
          });

          // Finds or creates category in MongoDB
          let categoryDoc = await Category.findOne({ name: metadata.category });
          if (!categoryDoc) {
            categoryDoc = new Category({ name: metadata.category });
            await categoryDoc.save();
            console.log(`Created category: ${metadata.category}`);
          }

          // Registers or updates book in MongoDB
          let book = await Book.findOne({ title: metadata.title });
          const fileId = `azure-${transliteratedCategory}/${path.basename(
            fullPath
          )}`;
          if (book) {
            book.author = metadata.author;
            book.category = categoryDoc._id;
            book.downloadUrl = downloadUrl;
            book.fileId = fileId;
            book.seriesId = seriesId;
            book.description = metadata.description;
            await book.save();
            console.log(`Updated book: ${metadata.title}`);
          } else {
            book = new Book({
              title: metadata.title,
              author: metadata.author,
              category: categoryDoc._id,
              downloadUrl,
              fileId,
              description: metadata.description,
              seriesId,
            });
            await book.save();
            console.log(`Added book: ${metadata.title}`);
          }
        }
      }
    }

    // Starts processing the folder
    await processFolder(folderPath);
    console.log("All books processed successfully!");
  } catch (error) {
    // Logs and rethrows errors
    console.error("Error during upload and registration:", error);
    throw error;
  } finally {
    // Closes MongoDB connection
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Parses command-line arguments
const [, , folderPath = "./books/"] = process.argv;
// Validates folder path
if (!folderPath) {
  console.log("Usage: node upload-books.js <folderPath>");
  console.log("Example: node upload-books.js ./books/");
  process.exit(1);
}

// Executes the main function
uploadAndRegisterBooks(folderPath);
