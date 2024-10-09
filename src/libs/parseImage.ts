import { inscriptionData } from "../../custom";

export function parseDataUrl(
  dataUrl: string | any,
  supply: number,
  revealAddr: string | null
): inscriptionData {
  // Check if it's a valid data URL
  // if (!dataUrl.startsWith("data:")) {
  //   throw new Error("Invalid data URL");
  // }

  // Split the string at the comma to separate metadata from the actual data
  const [metadata, base64Data] = dataUrl.split(",");

  // Extract the content type
  const contentType = metadata.split(":")[1].split(";")[0];

  // Decode the base64 data to a buffer
  const imageBuffer = Buffer.from(base64Data, "base64");

  return { imageBuffer, contentType, supply, revealAddr };
}
