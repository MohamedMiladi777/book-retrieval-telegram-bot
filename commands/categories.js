import { Markup } from "telegraf";

const categoriesCommand = async (ctx, bookService) => {
  try {
    const categories = await bookService.getCategories();

    console.log("Fetched categories from Hugging face:", categories);
    if (categories.length === 0) {
      return ctx.reply("No categories available at the moment.");
    }

    // Create reply keyboard with brackets and spacing
    const keyboard = [
      ['[ تفسير ]', '[ حديث ]', '[ سيرة ]'],
      ['[ عقيدة ]', '[ فقه ]', '[ زهد و رقائق ]'],
      ['[ علوم أخرى ]', '[ قراءات ]']
    ];

    await ctx.reply(
      "📚 **مكتبة الكتب الإسلامية**\n\nاختر قسماً من الأقسام التالية:",
      Markup.keyboard(keyboard).resize()
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    ctx.reply(" An error occurred while fetching categories.");
  }
};

export default categoriesCommand;
