import { Markup } from "telegraf";

// bookCommand handles the process of retrieving books based on a user's category selection:
// Extracts category info from the button press (callbackData).
// Uses BookService to find books in that category from Hugging Face.
// Displays books as interactive buttons inside an inline keyboard.
// Uses try...catch to handle errors gracefully.
const bookCommand = async (ctx, bookService, directCategory = null) => {
  try {

    let categoryName

    if (directCategory){
      categoryName = directCategory
    }
    else {
      const callBackData = ctx.callbackQuery?.data;
      categoryName = callBackData.replace("category_", "");
    }
    // const callbackData = ctx.callbackQuery?.data;
    // if (!callbackData) {
    //   return ctx.reply("Invalid book selection");
    // }

    // const categoryName = callbackData.replace("category_", "");
    // Don't replace underscores - use exact dataset category name

    bookService.logger.info("Extracting category name", { categoryName });

    // Debug: Let's see what categories actually exist in the dataset
    const allBooks = await bookService._listMyDatasetFiles();
    const actualCategories = [
      ...new Set(allBooks.map((book) => book.category)),
    ];
    bookService.logger.info("Available categories in dataset", {
      actualCategories,
    });

    const books = await bookService.searchBooks({ category: categoryName });
    /*DEBIGGGGGIINGGNGINIGNIGNGN*/
    const multiVolumeBooks = books.filter((book) => book.isMultiVolume);
    console.log("DEBUG: Multi-volume books found:", multiVolumeBooks.length);
    if (multiVolumeBooks.length > 0) {
      console.log("DEBUG: First multi-volume book:", multiVolumeBooks[0]);
    }
    /*DEBIGGGGGIINGGNGINIGNIGNGN*/

    bookService.logger.info("Books search results", {
      booksFound: books.length,
      categoryName,
      searchedFor: categoryName,
      availableCategories: actualCategories,
    });

    if (books.length > 0) {
      bookService.logger.info("First book sample", {
        firstBook: books[0],
        bookProperties: Object.keys(books[0]),
      });
    }

    if (books.length === 0) {
      return ctx.reply("📚 No books available in this category.");
    }

    // Separate single books from multi-volume books
    const singleBooks = [];
    const multiVolumeGroups = {};

    for (const book of books) {
      if (book.isMultiVolume) {
        // Group by title (books with same title are same series)
        if (!multiVolumeGroups[book.title]) {
          multiVolumeGroups[book.title] = [];
        }
        multiVolumeGroups[book.title].push(book);
      } else {
        singleBooks.push(book);
      }
    }

    // Create keyboard buttons
    const keyboard = [];

    // Add multi-volume series buttons
    for (const seriesTitle in multiVolumeGroups) {
      const volumes = multiVolumeGroups[seriesTitle];
      const volumeCount = volumes.length;

      // Create short hash for series title to avoid button data limit
      const seriesHash = seriesTitle.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      const shortSeriesId = `sr_${Math.abs(seriesHash)
        .toString(36)
        .substring(0, 8)}`;
      console.log("DEBUG: Storing series mapping:");
      console.log("  Series ID:", shortSeriesId);
      console.log("  Series Title:", seriesTitle);

      bookService.storeSeriesMapping(shortSeriesId, seriesTitle);

      console.log(
        "  Stored successfully:",
        bookService.getSeriesByID(shortSeriesId)
      );

      keyboard.push([
        Markup.button.callback(
          `📚 ${seriesTitle} (${volumeCount} volumes)`,
          shortSeriesId
        ),
      ]);
    }

    // Add single book buttons
    for (const book of singleBooks) {
      keyboard.push([
        Markup.button.callback(`📖 ${book.title}`, `book_${book.id}`),
      ]);
    }

    if (keyboard.length === 0) {
      return ctx.reply("📚 No books available in this category.");
    }

    await ctx.reply(
      "📖 Select a book:",
      Markup.inlineKeyboard(keyboard, { columns: 1 })
    );
  } catch (error) {
    const categoryName =
      ctx.callbackQuery?.data?.replace("category_", "").replace(/_/g, " ") ||
      "unknown";
    bookService.logger.error("Error fetching books", {
      error: error.message,
      categoryName,
    });
    ctx.reply("An error occurred while fetching books.");
  }
};

export default bookCommand;
