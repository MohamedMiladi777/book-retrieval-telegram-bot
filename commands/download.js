import Book from "../models/bookModel.js";

// Define the async function
const downloadCommand = async (ctx) => {
  try {
    // Extract callback data
    const callbackData = ctx.callbackQuery?.data;
    console.log("Callback Data:", callbackData);

    if (!callbackData) {
      return ctx.reply("Invalid book selection.");
    }

    // Extract book title from callbackData
    const bookId = callbackData.replace("book_", "").trim();
    console.log("Extracted book ID:", bookId);

    // Query MongoDB to find the book by title
    const book = await Book.findById(bookId);

    // Log fetched book
    console.log("Fetched Book:", book);

    // If no book is found, inform the user and return
    if (!book) {
      return ctx.reply("❌ No book found with that title.");
    }

    // Send download link
    // await ctx.reply(`📥 Click below to download:\n${book.downloadUrl}`);
    await ctx.replyWithDocument(book.fileId);
  } catch (error) {
    console.error("❌ Error fetching book:", error);
    ctx.reply("❌ An error occurred while fetching the book.");
  }
};

// Export the function
export default downloadCommand;
