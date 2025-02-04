import fs from "fs";
import path from "path";

// Define interfaces for type safety
interface FeePayersFile {
  feePayers: string[];
  [key: string]: any; // Allow other properties
}

// Directory containing the JSON files
const INPUT_DIR = "./batch_results"; // Change this to your input directory path
const OUTPUT_FILE = "combined-feepayers.json";

function combineFeePayers(): void {
  // Create Set to store unique addresses
  const uniqueFeePayers = new Set<string>();

  try {
    // Read all files in the directory
    const files = fs.readdirSync(INPUT_DIR);

    // Process each JSON file
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(INPUT_DIR, file);
        console.log(`Processing file: ${file}`);

        // Read and parse JSON file
        const fileContent = fs.readFileSync(filePath, "utf8");
        const jsonData = JSON.parse(fileContent) as FeePayersFile;

        // Add feePayers to set
        if (Array.isArray(jsonData.feePayers)) {
          jsonData.feePayers.forEach((address: string) => {
            uniqueFeePayers.add(address.toLowerCase());
          });
        }
      }
    }

    // Convert Set to array
    const output: string[] = Array.from(uniqueFeePayers);

    // Write combined results to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log(`Combined ${output.length} unique feePayers`);
    console.log(`Results saved to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Error combining feePayers:", error);
    throw error;
  }
}

// Execute the script
combineFeePayers();
