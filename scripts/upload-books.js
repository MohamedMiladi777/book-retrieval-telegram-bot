import fs from "fs/promises"; // Imports promise-based fs for file operations
import path from "path"; // Imports path for file path handling
import { PDFDocument } from "pdf-lib"; // Imports PDFDocument for metadata extraction
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"; // Imports S3 client
import mongoose from "mongoose"; // Imports mongoose for connection cleanup
import Book from "../models/bookModel.js"; // Fixed path to root models folder
import Category from "../models/categoryModel.js"; // Fixed path
import connectDB from "../config/database.js"; // Fixed path to root config folder
import dotenv from "dotenv"; // Imports dotenv for environment variables

dotenv.config({ path: "../.env" }); // Loads environment variables from .env

// Initializes S3 client with credentials and region
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Defines async function to upload a file to S3
async function uploadFileToS3(filePath, s3Key) {
  // Reads file content into a buffer
  const fileStream = await fs.readFile(filePath);
  // Configures S3 upload parameters
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: s3Key,
    Body: fileStream,
    ContentType: "application/pdf",
  };
  // Uploads file to S3 using PutObjectCommand
  await s3Client.send(new PutObjectCommand(params));
  // Returns the public URL of the uploaded file
  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
}

// Defines async function to upload PDFs and register in MongoDB
async function uploadAndRegisterBooks(folderPath) {
  const s3BasePrefix = "books/"; // Sets S3 prefix for book storage

  try {
    // Connects to MongoDB
    await connectDB();

    // Defines recursive function to process folder contents
    async function processFolder(currentPath) {
      // Reads directory entries with type information
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      // Loops over each entry
      for (const entry of entries) {
        // Constructs full path for the entry
        const fullPath = path.join(currentPath, entry.name);

        // Recursively processes subfolders
        if (entry.isDirectory()) {
          await processFolder(fullPath);
        } else if (entry.name.endsWith(".pdf")) {
          // Constructs S3 key including subfolder
          const relativePath = path.relative(folderPath, fullPath);
          const s3Key = `${s3BasePrefix}${relativePath.replace(/\\/g, "/")}`;
          const pdfFile = entry.name;

          // Uploads PDF to S3 and gets download URL
          const downloadUrl = await uploadFileToS3(fullPath, s3Key);
          console.log(`Uploaded PDF: ${s3Key}`);

          // Extracts metadata from PDF
          const pdfBytes = await fs.readFile(fullPath);
          const pdfDoc = await PDFDocument.load(pdfBytes);
          const metadata = {
            title: pdfDoc.getTitle() || path.basename(pdfFile, ".pdf"),
            author: pdfDoc.getAuthor() || "Unknown",
            category: pdfDoc.getKeywords()?.[0] || "Unknown", // Takes first keyword
            description: pdfDoc.getSubject() || "No description for now",
          };
          console.log(`Extracted metadata for ${pdfFile}:`, metadata);

          // Finds or creates category in MongoDB
          let category = await Category.findOne({ name: metadata.category });
          if (!category) {
            category = new Category({ name: metadata.category });
            await category.save();
            console.log(`Created category: ${metadata.category}`);
          }

          // Registers or updates book in MongoDB
          let book = await Book.findOne({ title: metadata.title });
          const fileId = `s3-${relativePath.replace(/\\/g, "/")}`;
          if (book) {
            book.author = metadata.author;
            book.category = category._id;
            book.downloadUrl = downloadUrl;
            book.fileId = fileId;
            book.description = metadata.description;
            await book.save();
            console.log(`Updated book: ${metadata.title}`);
          } else {
            book = new Book({
              title: metadata.title,
              author: metadata.author,
              category: category._id,
              downloadUrl,
              fileId,
              description: metadata.description,
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