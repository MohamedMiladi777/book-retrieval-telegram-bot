import { BlobServiceClient } from "@azure/storage-blob";
import fs from "fs";
import fsPromises from "fs/promises";
import mime from "mime";
import "../config/database.js";
import saveBook from "./book-utils.js";

// Change: Renamed function from uploadFileToS3 to uploadFileToAzure to reflect Azure Blob Storage
// Change: Renamed parameter s3Key to blobName to align with Azure terminology
const uploadFileToAzure = async (filePath, blobName) => {
  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(
      `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
    );
    const containerClient = blobServiceClient.getContainerClient("books");

    const fileStats = await fsPromises.stat(filePath);
    const fileSize = fileStats.size;
    const fileStream = fs.createReadStream(filePath);
    const contentType = mime.getType(filePath) || "application/octet-stream";

    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const startTime = Date.now();

    await blockBlobClient.uploadStream(fileStream, 4 * 1024 * 1024, 20, {
      blobHTTPHeaders: { blobContentType: contentType },
    });

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const uploadRateBytesPerSec =
      durationMs > 0 ? fileSize / (durationMs / 1000) : 0;

    const fileUrl = blockBlobClient.url;
    console.log("File uploaded successfully:", fileUrl);

    // return {
    //   url: fileUrl,
    //   uploadRate: uploadRateBytesPerSec,
    // };
    return fileUrl
  } catch (error) {
    console.error("❌ Azure Blob Upload Error:", error.message);
    throw error;
  }
};

// Change: Updated uploadAndSaveBook parameter from s3Key to blobName to align with Azure terminology
const uploadAndSaveBook = async (
  filePath,
  blobName,
  title,
  author,
  category,
  fileId
) => {
  try {
    const { url: downloadUrl, uploadRate } = await uploadFileToAzure(
      filePath,
      blobName
    );
    const savedBook = await saveBook(
      title,
      author,
      category,
      downloadUrl,
      undefined,
      fileId
    );
    console.log(
      `Book saved: ${title}, Upload Rate: ${uploadRate.toFixed(2)} bytes/s`
    );
    return savedBook;
  } catch (error) {
    console.error("Error in uploadAndSaveBook:", error.message);
    throw error;
  }
};

export { uploadFileToAzure, uploadAndSaveBook };
