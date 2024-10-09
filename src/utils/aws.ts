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

      console.log(`Successfully retrieved ${key}`);
      return { contentType, content };
    } else {
      throw new Error("Response body is not a readable stream");
    }
  } catch (err) {
    console.error(`Error retrieving ${key}`, err);
    throw err;
  }
}

function streamToBase64(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export async function deleteFromS3(key: string) {
  await s3.deleteObject({
    Bucket: BUCKET_NAME,
    Key: key,
  });
}
