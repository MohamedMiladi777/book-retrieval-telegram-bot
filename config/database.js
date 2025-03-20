// const mongoose = require('mongoose')
import mongoose from "mongoose";


const connectDB = async () => {
try{
   await mongoose.connect("mongodb://127.0.0.1:27017/book-store", {
    // useNewUrlParser: true,
    // useUnifiedTopology: true
   });

   console.log("Database is connected :)")

} catch(error) {
    console.error("MongoDB connection failed", error.message)
    process.exit(1)
}



}

// module.exports = connectDB
export default connectDB