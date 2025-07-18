import * as hub from "@huggingface/hub";

// Dataset configuration - hardcoded for testing
const datasetOwner = "ieasybooks-org";
const datasetName = "waqfeya-library";
const token = process.env.HF_API_TOKEN;

export async function getDataSetInfo() {
  try {
    // Try with just the repo name as a string
    const repoName = `${datasetOwner}/${datasetName}`;
    
    console.log("Calling hub.datasetInfo with repo string:", repoName);

    const info = await hub.datasetInfo({
      name: repoName,  // Just use the string, not an object
      accessToken: token,
    });
    
    return {
      id: info.id,
      description: info.description,
      tags: info.tags,
      downloads: info.downloads,
      likes: info.likes,
      private: info.private,
      createdAt: info.createdAt,
      lastModified: info.lastModified,
    };
  } catch (error) {
    throw new Error(`Failed to get dataset info: ${error.message}`);
  }
}

// Run it directly when called with node
if (import.meta.url === `file://${process.argv[1]}`) {
  getDataSetInfo()
    .then(info => console.log(JSON.stringify(info, null, 2)))
    .catch(error => console.error(error.message));
}