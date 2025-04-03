import axios from "axios";
import fs from "fs";

// This function downloads a file from a given URL and saves it to the specified output path
// It uses axios to make the HTTP GET request and streams the response data to a file
// It returns a promise that resolves with the output path of the downloaded file
// The function handles errors and logs them to the console
// and rethrows the error for further handling
const downloadFile = async (url, outputPath) => {
  try {
    const response = await axios.get(url, {
      // method: "GET",
      responseType: "stream",
    });
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on("finish", () => {
        resolve(outputPath);
        writer.on("error", reject);
      });
    });
  } catch (error) {
    console.error("Error downloading file:", error.message);
    throw error;
  }
};

export { downloadFile };
