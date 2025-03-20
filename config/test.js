const mongoose = require('mongoose');

// Enhanced connection with logging
async function connectToDatabase() {
    console.log('Attempting to connect to MongoDB...');
    try {
        await mongoose.connect('mongodb://localhost:27017/book-store');
        console.log('✅ Successfully connected to MongoDB');
        return true;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error.message);
        return false;
    }
}

// Enhanced test function with detailed logging
async function testDatabase() {
    console.log('\n=== Starting Database Tests ===');
    
    // Test connection
    const isConnected = await connectToDatabase();
    if (!isConnected) {
        console.log('❌ Tests aborted: Database connection failed');
        return;
    }

    try {
        // Find all books with detailed logging
        console.log('\n1. Finding all books...');
        const books = await mongoose.model('Book').find();
        console.log('✅ Found books:', books.length);
        console.log('Books data:', JSON.stringify(books, null, 2));

        // Find by category
        console.log('\n2. Finding fiction books...');
        const fictionBooks = await mongoose.model('Book').find({ category: 'Fiction' });
        console.log('✅ Found fiction books:', fictionBooks.length);
        console.log('Fiction books data:', JSON.stringify(fictionBooks, null, 2));

        // Update a book
        console.log('\n3. Updating a book...');
        const updatedBook = await mongoose.model('Book')
            .findOneAndUpdate(
                { title: 'Test Book' },
                { author: 'Updated Author' },
                { new: true }
            );
        console.log('✅ Book updated:', JSON.stringify(updatedBook, null, 2));

        // Delete a book
        console.log('\n4. Deleting a book...');
        const deleteResult = await mongoose.model('Book').deleteOne({ title: 'Test Book' });
        console.log('✅ Delete result:', deleteResult);

        console.log('\n=== Tests Completed Successfully ===');
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run tests with error handling
console.log('Starting test script...');
testDatabase()
    .then(() => {
        console.log('Test script completed');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Test script failed:', error.message);
        process.exit(1);
    });