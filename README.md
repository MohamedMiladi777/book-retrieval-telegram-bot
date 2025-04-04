## Telegram book library (المكتبة اﻷثرية)
A Telegram bot that allows users to browse books by category and download them from an AWS S3 bucket. Admins can add new books via a secure /addbook command. Built with Node.js, Telegraf, MongoDB, and AWS S3.

### Features
Browse Categories: Users can list available book categories with /categories.  
Download Books: Select a category, pick a book, and download it directly in Telegram.  
Admin Book Management: Add books with /addbook (restricted to the admin).  
Storage: Books are stored in AWS S3, with metadata in MongoDB.

### Prerequisites
Before you start, ensure you have:  

Node.js (v16 or higher) installed.  
A Telegram account.  
A MongoDB instance (local or cloud, e.g., MongoDB Atlas).  
An AWS account with an S3 bucket.  
Git installed.

### Setup Instructions
#### Step 1: Create a Telegram Bot with BotFather
Open Telegram and search for @BotFather.  
Start a Chat: Send /start.  
Create a Bot: Send /newbot.  
Follow prompts to name your bot (e.g., "MiladyShadyBot") and set a username (e.g., "@MiladyShadyBot").  
BotFather will provide a BOT_TOKEN (e.g., 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11).  
Save the Token: You’ll need it later.

#### Step 2: Clone the Repository
Clone this project to your local machine:

#### Step 3: Install Dependencies
Install the required Node.js packages:

#### Step 4: Configure Environment Variables
Create a .env File: In the project root, create a file named .env.  

Add the Following:  
BOT_TOKEN=your_bot_token_from_botfather  
AWS_REGION=your_aws_region  
AWS_ACCESS_KEY_ID=your_aws_access_key  
AWS_SECRET_ACCESS_KEY=your_aws_secret_key  
AWS_BUCKET_NAME=your_s3_bucket_name  
PORT=4040  

Replace:  
your_bot_token_from_botfather with the token from BotFather.  
your_aws_region (e.g., eu-west-3).  
your_aws_access_key and your_aws_secret_key from your AWS IAM user (with S3 permissions).  
your_s3_bucket_name with your S3 bucket name (e.g., miladyshadybotfiles).

#### Step 5: Set Up MongoDB
Local MongoDB:  
Install MongoDB locally (e.g., via official docs).  
Start it: mongod (default runs on mongodb://localhost:27017).  
MongoDB Atlas (Cloud):  
Sign up at MongoDB Atlas.  
Create a cluster, get the connection string (e.g., mongodb+srv://user:pass@cluster0.mongodb.net/book_store), and update config/database.js if needed.  
Database: The bot uses a database named book_store (configured in config/database.js).

#### Step 6: Configure AWS S3
Create an S3 Bucket:

#### Step 7: Run the Bot
1) Start the Bot: node index.js  
2) Test in Telegram:  
Open Telegram, find your bot, and send /start or /categories.

### Usage
#### For Users:
List Categories: Send /categories to see available book categories.  
Browse Books: Click a category button to see books, then click a book to download it.

#### For Admin:
Add a Book: Send a document with a caption like:  
/addbook Title: Book Name, Author: Author Name, Category: Category Name  
Replace Book Name, Author Name, and Category Name with your details.  
Note: Only the admin (Telegram ID in index.js as ADMIN_ID) can use this command.  
Set Your Admin ID:  
Find your Telegram ID by sending a message to @userinfobot.  
Update index.js:  
const ADMIN_ID = "your_telegram_id"; // e.g., "1921769178"  
Log in to AWS Console, go to S3, and create a bucket.  
Note the region (e.g., eu-west-3).
