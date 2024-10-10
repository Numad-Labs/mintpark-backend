import { LAYER_TYPE } from "@prisma/client";
import { randomUUID } from "crypto";
import { getObjectFromS3, uploadToS3 } from "../utils/aws";
import { Readable } from "stream";
import { createFundingAddress } from "../libs/fundingAddress";
import { orderRepository } from "../repositories/orderRepository";

function bufferToMulterFile(
  buffer: Buffer,
  mimeType: string,
  originalname: string
): Express.Multer.File {
  return {
    fieldname: "file",
    originalname,
    encoding: "7bit",
    mimetype: mimeType,
    buffer,
    size: buffer.length,
    stream: new Readable(),
    destination: "",
    filename: originalname,
    path: "",
  };
}

export const fungibleTokenServices = {
  createOrder: async (
    brc20Ticker: string,
    brc20Max: string,
    brc20Limit: string,
    price: number,
    mintLayerType: LAYER_TYPE,
    feeRate: number,
    issuerAddress: string
  ) => {
    const inscription = Buffer.from(
      JSON.stringify({
        p: "brc-20",
        op: "deploy",
        tick: brc20Ticker,
        max: brc20Max,
        limit: brc20Limit,
      }),
      "utf-8"
    );
    const multerFile = bufferToMulterFile(
      inscription,
      "application/json",
      `${brc20Ticker}-deployment.json`
    );
    const key = randomUUID();
    const s3response = await uploadToS3(key, multerFile);

    const funder = createFundingAddress({
      inscriptions: [
        {
          inscriptionData: inscription,
          inscriptionContentType: multerFile.mimetype,
        },
      ],
      price: price,
      feeRate: feeRate,
      layerType: mintLayerType,
    });

    const hashedPrivateKey = funder.privateKey;

    const order = await orderRepository.create({
      amount: funder.requiredAmount,
      feeRate: feeRate,
      userAddress: issuerAddress,
      fundingAddress: funder.address,
      fundingPrivateKey: hashedPrivateKey,
      serviceFee: price,
      networkFee: funder.requiredAmount - price,
      collectibleKey: key,
      layerType: mintLayerType,
      mintingType: "BRC20",
      quantity: Number(brc20Max),
    });

    return order;
  },
};
