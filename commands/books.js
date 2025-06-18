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
    const category = await Category.findOne({ name: categoryName });

    if (!category) {
      return ctx.reply("❌ No category found.");
    }

    const books = await Book.find({ category: category._id });
    console.log("Fetched books from DB:", books);
    if (books.length === 0) {
      return ctx.reply("📚 No books available in this category.");
    }
    //const seriesId = []
    const singleBooks = [];
    const seriesMap = {};
    // make a for of loop to iterate each book object
    // Group books by seriesId
    for (const book of books) {
      if (book.seriesId) {
        if (!seriesMap[book.seriesId]) {
          seriesMap[book.seriesId] = [];
        }
        seriesMap[book.seriesId].push(book);
      } else {
        singleBooks.push(book);
      }
    }

    const keyboard = [];
    for (const seriesId in seriesMap) {
      const seriesBooks = seriesMap[seriesId];
      const seriesTitle = seriesBooks[0].title.split(" المجلد")[0];
      const volumeCount = seriesBooks.length;
      keyboard.push([
        Markup.button.callback(
          `${seriesTitle} (${volumeCount} volumes)`,
          `series_${seriesId}`
        ),
      ]);
    }

    for (const book of singleBooks) {
      keyboard.push([
        Markup.button.callback(
          `📖 ${book.title}`,
          `book_${book._id.toString()}`
        ),
      ]);
    }
    //Use for for of loop to iterate over singlebooks
    //push to button the book title and and convert the book._id to string

    if (keyboard.length === 0) {
      return ctx.reply("📚 No books available in this category.");
    }

    await ctx.reply(
      "📖 Select a book:",
      Markup.inlineKeyboard(keyboard, { columns: 2 })
    );
  } catch (error) {
    console.error("Error fetching books:", error);
    if (ctx) {
      ctx.reply("An error occurred while fetching books.");
    }
  }
};

export default bookCommand;
