import { PDFDocument } from "pdf-lib"; // Imports PDFDocument class to manipulate PDFs
import fs from "fs/promises"; // Imports promise-based fs for async file operations
import path from "path"; // Imports path for cross-platform file paths

// Defines an async function to embed metadata into PDFs
async function embedMetadata(folderPath, books) {
  // Loops over each book object in the books array
  for (const book of books) {
    // Constructs the full file path using book.filename
    const pdfPath = path.join(folderPath, book.filename);
    try {
      // Reads the PDF file into a buffer asynchronously
      const pdfBytes = await fs.readFile(pdfPath);
      // Loads the PDF document from the buffer
      const pdfDoc = await PDFDocument.load(pdfBytes);

      // Sets the PDF's metadata fields
      pdfDoc.setTitle(book.title);
      pdfDoc.setAuthor(book.author);
      pdfDoc.setKeywords([book.category]); // Wraps category in an array
      pdfDoc.setSubject(book.description || "No description");

      // Saves the modified PDF to a byte array
      // const modifiedBytes = await pdfDoc.save();
      // Writes the modified bytes back to the original file
      const pdfBytesSerialized = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytesSerialized);

      // Logs confirmation of metadata embedding
      const reloadedDoc = await PDFDocument.load(pdfBytesSerialized);
      console.log(
        `Embedded metadata in ${book.filename}, keywords:`,
        reloadedDoc.getKeywords()
      );
    } catch (error) {
      // Logs errors for individual books without stopping the loop
      console.error(`Failed to process ${book.filename}:`, error);
    }
  }
}

// Defines the array of books with their metadata
const books = [
  {
    filename: "عقيدة/Khalal_v1.pdf",
    title: "السنة لأبي بكر الخلال المجلد الأول",
    author: "أبو بكر الخلال",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Khalal_v2.pdf",
    title: "السنة لأبي بكر الخلال المجلد الثاني",
    author: "أبو بكر الخلال",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Mokhtar.pdf",
    title: "مختار من السنة لأبي بكر الخلال",
    author: "أبو بكر الخلال",
    category: "عقيدة",
  },
  // Add your remaining 27 books here, e.g., { filename: "عقيدة/OtherBook.pdf", ... }
];

// Calls the embedMetadata function with error handling
embedMetadata("./books/", books).catch((error) => {
  console.error("Error embedding metadata:", error);
  process.exit(1); // Exits with error code for CLI
});
