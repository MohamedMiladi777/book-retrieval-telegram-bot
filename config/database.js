// const mongoose = require('mongoose')
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    console.log("Raw MONGODB_URI from process.env:", process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });

    console.log(" Database is connected :)");
  } catch (error) {
    console.error("connection failed", error.message);
    process.exit(1);
  }
};

// module.exports = connectDB
export default connectDB;
