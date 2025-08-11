import { Markup } from "telegraf";

// bookCommand handles the process of retrieving books based on a user's category selection:
// Extracts category info from the button press (callbackData).
// Uses BookService to find books in that category from Hugging Face.
// Displays books as interactive buttons inside an inline keyboard.
// Uses try...catch to handle errors gracefully.
const bookCommand = async (ctx, bookService, directCategory = null, pageNumber = 1) => {
  try {
    // NOTE: No rate limiting here - users should browse freely
    // Rate limiting only applies to actual downloads

    // STEP 1: Determine categoryName FIRST
    let categoryName;
    if (directCategory) {
      categoryName = directCategory;
    } else {
      const callBackData = ctx.callbackQuery?.data;
      categoryName = callBackData.replace("category_", "");
    }

    // STEP 2: Now we can use categoryName to search books
    const books = await bookService.searchBooks({ category: categoryName });

    // STEP 3: Set up pagination with the provided page number
    const BOOKS_PER_PAGE = 8;
    const page = pageNumber; // Use the page parameter instead of hardcoded 1

    const startIndex = (page - 1) * BOOKS_PER_PAGE;
    const endIndex = startIndex + BOOKS_PER_PAGE;
    const booksToShow = books.slice(startIndex, endIndex);

    // STEP 4: Set up pagination with navigation buttons
    const keyboard = [];
    
    // Add pagination controls if needed
    const paginationRow = [];
    if (page > 1) {
      paginationRow.push(
        Markup.button.callback("◀️ السابق", `page_${page - 1}_${categoryName}`)
      );
    }
    if (endIndex < books.length) {
      paginationRow.push(
        Markup.button.callback("التالي ▶️", `page_${page + 1}_${categoryName}`)
      );
    }
    
    if (paginationRow.length > 0) {
      keyboard.push(paginationRow);
    }

    bookService.logger.info("Extracting category name", { categoryName });

    // Debug: Let's see what categories actually exist in the dataset
    const allBooks = await bookService._listMyDatasetFiles();
    const actualCategories = [
      ...new Set(allBooks.map((book) => book.category)),
    ];
    bookService.logger.info("Available categories in dataset", {
      actualCategories,
    });

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

    for (const book of booksToShow) {
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

    // Add multi-volume series buttons to existing keyboard
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

    // Calculate pagination info for user feedback
    const totalPages = Math.ceil(books.length / BOOKS_PER_PAGE);
    const pageInfo = totalPages > 1 ? `\n📄 الصفحة ${page} من ${totalPages}` : "";

    await ctx.reply(
      `📖 Select a book:${pageInfo}`,
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
