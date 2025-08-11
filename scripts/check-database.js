import connectDB from '../config/database.js';
import BookCache from '../models/bookCacheModel.js';
import mongoose from 'mongoose';

async function checkDatabase() {
  try {
    console.log('🔍 Checking MongoDB Atlas database...');
    
    await connectDB();
    
    const count = await BookCache.countDocuments();
    console.log(`📊 Total documents in BookCache collection: ${count}`);
    
    if (count === 0) {
      console.log('📝 Collection is empty. Population may have failed or not completed.');
      console.log('🔄 Try running the population script again.');
    } else {
      console.log('✅ Collection has data! Let me show you some samples...');
      
      // Get distinct categories
      const categories = await BookCache.distinct('category');
      console.log(`📂 Categories found: ${categories.join(', ')}`);
      
      // Show sample from each category
      for (const category of categories.slice(0, 3)) {
        const sample = await BookCache.findOne({ category });
        console.log(`\n📖 Sample from "${category}":`);
        console.log(`   ID: ${sample.bookId}`);
        console.log(`   Title: ${sample.title}`);
        console.log(`   Multi-volume: ${sample.isMultiVolume}`);
        console.log(`   File: ${sample.filePath}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

checkDatabase();
