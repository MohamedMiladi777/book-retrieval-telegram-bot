import dotenv from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import mime from "mime";
import { FmtString } from "telegraf/format";

dotenv.config({ path: "../.env" });
console.log("AWS Region:", process.env.AWS_REGION);

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const uploadFileToS3 = async (filePath, s3Key) => {
  try {
    console.log("Starting file check");

    // a readable stream from the file
    const fileStream = fs.createReadStream(filePath);
    console.log("Creating stream", fileStream);
    //determine the MIME type of the file
    const contentType = mime.getType(filePath) || "application/octet-stream";
    console.log("setting params");

    const uploadParams = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: fileStream,
      ContentType: contentType,
      //   ACL: "public-read",
    };

    console.log("Sending to S3");
    await s3Client.send(new PutObjectCommand(uploadParams));
    console.log("Upload done, returning URL")
    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log("File uploaded successfully:", fileUrl);
    return fileUrl;
  } catch (error) {
    console.error("❌ S3 Upload Error:", error.message);
    throw error;
  }
};

uploadFileToS3("SunnahAhmad.pdf", "books/SunnahAhmad.pdf")
  .then((url) => console.log("Uploaded Url:", url))
  .catch((err) => console.log("Upload failed: ", err));
