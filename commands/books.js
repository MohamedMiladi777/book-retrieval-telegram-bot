import { Markup } from "telegraf";
import Book from "../models/bookModel.js";
import Category from "../models/categoryModel.js";

// bookCommand handles the process of retrieving books based on a user's category selection:
// Extracts category info from the button press (callbackData).
// Queries the MongoDB database to find books in that category.
// Displays books as interactive buttons inside an inline keyboard.
// Uses try...catch to handle errors gracefully.
const bookCommand = async (ctx) => {
  try {
    const callbackData = ctx.callbackQuery?.data;
    // console.log("callbackData", callbackData);
    if (!callbackData) {
      return ctx.reply("Invalid book selection");
    }

    const categoryName = callbackData.replace("category_", "").trim();
    console.log("Extract the category name:", categoryName);
    //Debug: Check for invisible chars
    // console.log(
    //   "Extracted category name:",
    //   categoryName,
    //   "| Char codes:",
    //   categoryName.split("").map((c) => c.charCodeAt(0))
    // );

    const category = await Category.findOne({ name: categoryName });

    if (!category) {
      return ctx.reply("❌ No category found.");
    }

    const books = await Book.find({ category: category._id });
    console.log("Fetched books from DB:", books);
    if (books.length === 0) {
      return ctx.reply("📚 No books available in this category.");
    }

    const buttons = books.map((book) => {
      const callbackData = `book_${book._id.toString()}`; // Using MongoDB ID

      console.log(`Generated callback data: ${callbackData}`); // Debugging
      return Markup.button.callback(`📖 ${book.title}`, callbackData);
      // Markup.button.callback(
      //   `📖 ${book.title}`,
      //   `book_${book.title.replace(/\s+/g, "_")}`
      // );
    });

    await ctx.reply(
      "📖 Select a book:",
      Markup.inlineKeyboard(buttons, { columns: 2 })
    );
  } catch (error) {
    console.error("Error fetching books:", error);
    if (ctx) {
      ctx.reply("An error occurred while fetching books.");
    }
  }
};

export default bookCommand;
