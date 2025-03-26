import { Markup } from "telegraf";
import Category from "../models/categoryModel.js";

const categoriesCommand = async (ctx) => {
 
  try {
    const categories = await Category.find();
    console.log("Fetched categories from DB:", categories);
    if (categories.length === 0) {
      return ctx.reply("No categories available at the moment.");
    }

    const buttons = categories.map(category => 
      Markup.button.callback(category.name, `category_${category.name.replace(/\s+/g, "_")}`)
    );
    
    await ctx.reply(
      "📚 Select a book category:",
      Markup.inlineKeyboard(buttons.map(btn => [btn]))
    );
  } catch (error) {
    console.error("Error fetching categories:", error);
    ctx.reply(" An error occurred while fetching categories.");
  }
};

export default categoriesCommand;
