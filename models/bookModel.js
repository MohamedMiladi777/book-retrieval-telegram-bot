// const mongoose = require('mongoose'); // Import Mongoose
import mongoose from "mongoose";

// Define the Book schema
const bookSchema = new mongoose.Schema({
    title: {
        type: String, // Field type is String
        required: true // The title is required when adding a book
    },
    author: {
        type: String, // Field type is String
        required: true ,// The author is required when adding a book
    },
    category: {
        type: String, // Field type is String
        required: true // The category is required when adding a book
    },
    downloadUrl: {
        type: String, // Field type is String
        required: true // The downloadUrl is required when adding a book
    },
    createdAt: {
        type: Date, // Field type is Date
        default: Date.now // Sets the current date/time by default
    }
});

// Export the Book model
// module.exports = mongoose.model('Book', bookSchema);
const Book = mongoose.model("Book", bookSchema);
export default Book; // ✅ Correct ESM export
