import fs from "fs/promises";
import path from "path";

async function processFeePayerAddresses() {
  try {
    // Read the input file
    const fileContent = await fs.readFile("combined-feepayers.json", "utf8");
    const addresses: string[] = JSON.parse(fileContent);

    console.log(`Total addresses before deduplication: ${addresses.length}`);

    // Create a Set with normalized addresses (lowercase) to remove duplicates
    const uniqueAddresses = Array.from(
      new Set(addresses.map((addr) => addr.toLowerCase()))
    ).sort();

    console.log(`Total unique addresses: ${uniqueAddresses.length}`);
    console.log(
      `Removed ${addresses.length - uniqueAddresses.length} duplicates`
    );

    // Create the output JSON with proper formatting
    const outputJson = JSON.stringify(uniqueAddresses, null, 2);

    // Write to a new file
    await fs.writeFile("unique-feepayers.json", outputJson);

    return {
      originalCount: addresses.length,
      uniqueCount: uniqueAddresses.length,
      duplicatesRemoved: addresses.length - uniqueAddresses.length
    };
  } catch (error) {
    console.error("Error processing addresses:", error);
    throw error;
  }
}

// Execute the function
processFeePayerAddresses()
  .then((result) => {
    console.log("Processing completed successfully!");
    console.log("Results:", result);
  })
  .catch((error) => {
    console.error("Failed to process addresses:", error);
  });

// If you're using CommonJS instead of ES modules, use this version:
/*
const fs = require('fs/promises');
const path = require('path');

async function processFeePayerAddresses() {
  // ... same function body ...
}
*/
