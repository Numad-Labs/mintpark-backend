export interface S3FileResponse {
  contentType?: string;
  content: string; // base64 string
  contentLength?: number;
}

export interface PinResponse {
  IpfsHash: string;
  PinSize?: number;
  Timestamp?: string;
}
