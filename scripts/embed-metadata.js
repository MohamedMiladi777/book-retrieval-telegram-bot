import { PDFDocument } from "pdf-lib"; // Imports PDFDocument class to manipulate PDFs
import fs from "fs/promises"; // Imports promise-based fs for async file operations
import path, { basename } from "path"; // Imports path for cross-platform file paths

// Helper function to get the base name of a file (e.g., "Khalal_1.pdf" -> "Khalal")
function getBaseName(filename) {
  const name = path.basename(filename, ".pdf");
  return name.split("_")[0];
}

// Generates seriesId from base name
function generateSeriesId(baseName) {
  return `series_${baseName.toLowerCase()}`;
}

// Defines an async function to embed metadata into PDFs
async function embedMetadata(folderPath, books) {
  const seriesMap = {};

  for (const book of books) {
    // Constructs the full file path using book.filename

    const baseName = getBaseName(book.filename);
    //if statement: check if seriesMap exists or not
    if (!seriesMap[baseName]) {
      seriesMap[baseName] = {
        seriesId: generateSeriesId(baseName),
        volumes: [],
      };
    }
    seriesMap[baseName].volumes.push(book);
  }
  // Loops over each book object in the books array
  for (const book of books) {
    // Constructs the full file path using book.filename

    const pdfPath = path.join(folderPath, book.filename);
    console.log("parsed filename = ", book.filename);
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

      //Add multi volume book feature
      const baseName = getBaseName(book.filename);
      const keywords = [book.category];
      if (seriesMap[baseName].volumes.length > 1) {
        keywords.push(seriesMap[baseName].seriesId);
        console.log(`length : ${seriesMap[baseName].volumes.length} `)

      }
      pdfDoc.setKeywords(keywords);
      console.log(`keywords : ${keywords} `)


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
    filename: "عقيدة/Khalal_1.pdf",
    title: "السنة لأبي بكر الخلال المجلد الأول",
    author: "أبو بكر الخلال",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Khalal_2.pdf",
    title: "السنة لأبي بكر الخلال المجلد الثاني",
    author: "أبو بكر الخلال",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Mokhtar.pdf",
    title: "المختار" ,
    author: "أبو بكر الخلال",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Ajurri_1.pdf",
    title: "الشريعة المجلد اﻷول",
    author: "اﻵجري",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Ajurri_2.pdf",
    title: " الشريعة المجلد الثاني",
    author: "اﻵجري",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Ajurri_3.pdf",
    title: " الشريعة المجلد الثالث",
    author: "اﻵجري",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Jami_1.pdf",
    title: "الجامع لعقائد أهل السنة و اﻷثر المجلد اﻷول",
    author: "عادل آل حمدان",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Jami_2.pdf",
    title: "الجامع لعقائد أهل السنة و اﻷثر المجلد الثاني",
    author: "عادل آل حمدان",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Sunnah_Ahmad.pdf",
    title: "السنة لعبد الله بن أحمد",
    author: "عبد الله بن أحمد",
    category: "عقيدة",
  },
  {
    filename: "عقيدة/Sunnah_Harb.pdf",
    title: "السنة لحرب",
    author:  "حرب الكرماني",
    category: "عقيدة",
  },


  // Add the remaining 27 books here, e.g., { filename: "عقيدة/OtherBook.pdf", ... }
];

// Calls the embedMetadata function with error handling
embedMetadata("./books/", books).catch((error) => {
  console.error("Error embedding metadata:", error);
  process.exit(1); // Exits with error code for CLI
});
