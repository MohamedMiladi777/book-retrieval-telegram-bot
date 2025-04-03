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
    //create a new book document
    const book = new Book({
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


export default saveBook
