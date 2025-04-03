import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import mime from "mime";
import "../config/database.js";
import saveBook from "./book-utils.js";

// Function to upload a file to S3
/**
 * Uploads a file to an S3 bucket.
 *
 * @param {string} filePath - The path to the file to upload.
 * @param {string} s3Key - The key (path) in the S3 bucket where the file will be stored.
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
const uploadFileToS3 = async (filePath, s3Key) => {
  try {
    // console.log("AWS Region:", process.env.AWS_REGION);
    // Set up AWS client
    const s3Client = new S3Client({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    console.log("AWS Credentials Loaded:", {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        ? "[redacted]"
        : "undefined",
    });
    console.log("Starting file check");

    // a readable stream from the file
    const fileStream = fs.createReadStream(filePath);
    console.log("Creating stream", fileStream);
    //determine the MIME type of the file
    const contentType = mime.getType(filePath) || "application/octet-stream";
    console.log("setting params");
    //  // Set up S3 upload parameters
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
      //   ACL: "public-read",
    };

    console.log("Sending to S3");
    // Upload the file to S3
    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log("Upload done, returning URL");
    // Construct the file URL
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log("File uploaded successfully:", fileUrl);

    return fileUrl;
  } catch (error) {
    console.error("❌ S3 Upload Error:", error.message);
    throw error;
  }
};

const uploadAndSaveBook = async (
  filePath,
  s3Key,
  title,
  author,
  category,
  fileId
) => {
  try {
    // await connectDB();
    const downloadUrl = await uploadFileToS3(filePath, s3Key);
    const savedBook = await saveBook(
      title,
      author,
      category,
      downloadUrl,
      undefined,
      fileId
    );
    return savedBook;
  } catch (error) {
    console.error("Error in uploadAndSaveBook:", error.message);
    throw error;
  }
};

export { uploadFileToS3, uploadAndSaveBook };
