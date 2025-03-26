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
    const bookTitle = callbackData
      .replace("book_", "")
      .replace(/_/g, " ")
      .trim();
    console.log("Extracted Book Title:", bookTitle);

    // Query MongoDB to find the book by title
    const book = await Book.findOne({ title: bookTitle });

    // Log fetched book
    console.log("Fetched Book:", book);

    // If no book is found, inform the user and return
    if (!book) {
      return ctx.reply("❌ No book found with that title.");
    }

    // Send download link
    await ctx.reply(`📥 Click below to download:\n${book.downloadUrl}`);
  } catch (error) {
    console.error("❌ Error fetching book:", error);
    ctx.reply("❌ An error occurred while fetching the book.");
  }
};

// Export the function
export default downloadCommand;
