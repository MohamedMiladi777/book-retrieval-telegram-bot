import { Markup } from "telegraf";

/**
 * Transform category name for display
 * @param {string} categoryName - Internal category name
 * @returns {string} Display-friendly name with brackets
 */
function formatCategoryForDisplay(categoryName) {
  // Replace underscores with spaces and add brackets
  const displayName = categoryName.replace(/_/g, ' ');
  return `[ ${displayName} ]`;
}

/**
 * Create keyboard layout with flexible rows
 * @param {Array} categories - Array of category objects
 * @param {number} itemsPerRow - Number of buttons per row (default: 3)
 * @returns {Array} 2D array for keyboard layout
 */
function createKeyboardLayout(categories, itemsPerRow = 3) {
  // Transform categories to display format
  const displayCategories = categories.map(cat => formatCategoryForDisplay(cat.name));
  
  // Create rows with specified items per row
  const rows = [];
  for (let i = 0; i < displayCategories.length; i += itemsPerRow) {
    rows.push(displayCategories.slice(i, i + itemsPerRow));
  }
  
  return rows;
}

// Used dependency injection to avoid coupling
const categoriesCommand = async (ctx, bookService) => {
  try {
    const categories = await bookService.getCategories();

    console.log("Fetched categories from BookService:", categories);
    if (categories.length === 0) {
      return ctx.reply("No categories available at the moment.");
    }

    // Generate dynamic keyboard layout from fetched categories
    const keyboard = createKeyboardLayout(categories, 3);

    console.log("Generated keyboard layout:", keyboard);

    await ctx.reply(
      "📚 **مكتبة الكتب الإسلامية**\n\nاختر قسماً من الأقسام التالية:",
      Markup.keyboard(keyboard).resize()
    );
  } catch (error) {
    console.error("[ERROR] Error fetching categories:", error);
    ctx.reply("An error occurred while fetching categories.");
  }
};

export default categoriesCommand;
