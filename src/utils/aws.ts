import {
  S3,
  GetObjectCommand,
  GetObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { config } from "../config/config";

const ACCESS_KEY = config.AWS_S3_ACCESS_KEY;
const SECRET_KEY = config.AWS_S3_SECRET_KEY;
const BUCKET_NAME = config.AWS_S3_BUCKET_NAME;

export const s3 = new S3({
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
  region: "eu-central-1",
});

export async function uploadToS3(key: string, file: Express.Multer.File) {
  const s3Response = await new Upload({
    client: s3,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  }).done();

  return s3Response;
}

async function batchUploadToS3(
  bucketName: string,
  files: Express.Multer.File[]
) {
  if (files.length > 10) {
    throw new Error("This function is optimized for up to 10 files.");
  }

  const uploadPromises = files.map((file) => uploadToS3(bucketName, file));

  try {
    const results = await Promise.allSettled(uploadPromises);

    return results;
  } catch (err) {
    console.error("Error in batch upload:", err);
    throw err;
  }
}

export async function getObjectFromS3(key: string) {
  try {
    const response: GetObjectCommandOutput = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    if (response.Body instanceof Readable) {
      const contentType = await response.ContentType;
      const content = await streamToBase64(response.Body);
      return { contentType, content };
    } else {
      throw new Error("Response body is not a readable stream");
    }
  } catch (err) {
    console.error(`Error retrieving ${key}`, err);
    throw err;
  }
}

function streamToBase64(stream: Readable) {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer.toString("base64"));
    });
  });
}

export async function deleteFromS3(key: string) {
  await s3.deleteObject({
    Bucket: BUCKET_NAME,
    Key: key,
  });
}
interface S3FileResponse {
  contentType: string | undefined;
  content: string;
}

export async function createMetadataFromS3File(
  fileKey: string,
  name: string,
  storage: any // Your storage service for IPFS
): Promise<string> {
  try {
    // Get the file from S3 using your existing function
    const file = await getObjectFromS3(fileKey);

    // Create the data URL from the file content
    const dataUrl = `data:${file.contentType};base64,${file.content}`;

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Create a File object
    const fileObject = new File([blob], fileKey.split("/").pop() || "unnamed", {
      type: file.contentType || "application/octet-stream",
    });

    // Upload to IPFS
    const imageResponse: PinResponse = await storage.upload.file(fileObject);

    // Create metadata object
    const metadata = {
      name: name || "Unnamed NFT",
      image: `ipfs://${imageResponse.IpfsHash}`,
    };

    // Upload metadata to IPFS
    const metadataResponse: PinResponse = await storage.upload.json(metadata);

    return `ipfs://${metadataResponse.IpfsHash}`;
  } catch (error) {
    console.error("Error in createMetadataFromS3File:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to create metadata from S3 file: ${errorMessage}`);
  }
}
// Example interface for PinResponse (adjust according to your actual types)
interface PinResponse {
  IpfsHash: string;
  PinSize?: number;
  Timestamp?: string;
}
