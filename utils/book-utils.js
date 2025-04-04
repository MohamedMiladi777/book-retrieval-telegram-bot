import Book from "../models/bookModel.js";

const saveBook = async (
  title,
  author,
  category,
  downloadUrl,
  description = "No description for now",
  fileId
) => {
  try {
    //check if book already exists
    let book = await Book.findOne({ title });
    if (book) {
      book.author = author;
      book.category = category;
      book.downloadUrl = downloadUrl;
      book.description = description;
      book.fileId = fileId;
      const updatedBook = await book.save();
      console.log("Book updated successfully:", updatedBook);
      return updatedBook;
    }
    //create a new book document
    book = new Book({
      title,
      author,
      category: category,
      downloadUrl,
      description,
      fileId,
    });
    const savedBook = await book.save();
    console.log("Book saved successfully:", savedBook);
    return savedBook;
  } catch (error) {
    console.error("Error saving book:", error);
    throw error;
  }
};

export default saveBook;
