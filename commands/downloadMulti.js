import { Markup } from "telegraf";

const seriesCommand = async (ctx, bookService) => {
  try {
    const callBackData = ctx.callbackQuery?.data;

    if (!callBackData) {
      return ctx.reply("Invalid series selection.");
    }

    const seriesId = callBackData

    console.log("extracted series ID:", seriesId);
    const seriesTitle = bookService.getSeriesByID(seriesId);
    if (!seriesTitle) {
      return ctx.reply("Invalid series selection.");
    }

    console.log("extracted series Title:", seriesTitle);
    const seriesBooks = await bookService.searchBooks({
      title: seriesTitle,
      isMultiVolume: true,
    });

    if (seriesBooks === 0) {
      return ctx.reply("No books found for this series.");
    }
    console.log("Fetched series books:", seriesBooks);

    const keyboard = seriesBooks
      .sort((a, b) => a.volume - b.volume)
      .map((book) => [
        Markup.button.callback(`📖 ${book.title} - $qq{book.volume}`, `book_${book.id}`
          
        ),
      ]);

    await ctx.reply(
      `Select a volume from ${seriesTitle}`,
      Markup.inlineKeyboard(keyboard, { columns: 1 })
    );
  } catch (error) {
    console.error("Error fetching series:", error);
    ctx.reply("An error occurred while fetching series.");
  }
};

export default seriesCommand;
