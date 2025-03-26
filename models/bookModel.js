// const mongoose = require('mongoose'); // Import Mongoose
import mongoose from "mongoose";

// Define the Book schema
const bookSchema = new mongoose.Schema({
    title: {
        type: String, // Field type is String
        required: true,// The title is required when adding a book
        unique: true // The title must be unique
    },
    author: {
        type: String, // Field type is String
        required: true ,// The author is required when adding a book
    },
    category: {
        type: mongoose.Schema.Types.ObjectId, // Field type is String
        ref: "Category", // Reference to the Category model
        required: true // The category is required when adding a book
    },
    downloadUrl: {
        type: String, // Field type is String
        required: true // The downloadUrl is required when adding a book
    },
    description: {
        type: String, // Field type is String
        default: "No description available" // Default value if no description is provided
    },
    createdAt: {
        type: Date, // Field type is Date
        default: Date.now // Sets the current date/time by default
    }
});


bookSchema.index({category: 1}); // Index the category field Improves performance when searching books by category.

// Export the Book model
// module.exports = mongoose.model('Book', bookSchema);
const Book = mongoose.model("Book", bookSchema);
export default Book; // ✅ Correct ESM export
