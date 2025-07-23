import { Markup } from "telegraf";

const categoriesCommand = async (ctx, bookService) => {
  try {
    const categories = await bookService.getCategories();

    console.log("Fetched categories from Hugging face:", categories);
    if (categories.length === 0) {
      return ctx.reply("No categories available at the moment.");
    }

    const buttons = categories.map((category) =>
      Markup.button.callback(
        category.name.replace(/_/g, " "), // Show user-friendly name with spaces
        `category_${category.name}` // Use exact dataset name for callback
      )
    );

    await ctx.reply(
      "📚 Select a book category:",
      Markup.inlineKeyboard(buttons.map((btn) => [btn]))
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    ctx.reply(" An error occurred while fetching categories.");
  }
};

export default categoriesCommand;
