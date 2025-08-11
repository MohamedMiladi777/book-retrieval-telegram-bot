import { logger } from "../logs/logger.js";

const downloadCommand = async (ctx, bookService) => {
  try {
    // Check rate limit first
    const userId = ctx.from.id;
    if (!bookService.checkRateLimit(userId)) {
      return ctx.reply(` تجاوزت الحد المسموح به من طلباتك في الوقت الحالي. يرجى المحاولة مرة أخرى لاحقاً.
        You have reached your request limit. Please try again later. (1 minute rate limit to prevent abuse)`);
    }

    // Extract callback data
    const callbackData = ctx.callbackQuery?.data;
    if (!callbackData) {
      return ctx.reply("Invalid book selection.");
    }

    // Extract book ID
    const bookId = callbackData.replace("book_", "").trim();
    logger.info("Processing download request", { bookId, userId });

    // Use the centralized download method from BookService
    await bookService.downloadBook(bookId, ctx);

  } catch (error) {
    logger.error("Download command failed", {
      error: error.message,
      stack: error.stack,
      userId: ctx.from.id
    });
    
    await ctx.reply("❌ Download failed. Please try again later.");
  }
};

export default downloadCommand;
