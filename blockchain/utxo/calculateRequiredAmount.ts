import { WITNESS_SCALE_FACTOR } from "./constants";

export function calculateInscriptionSize(
  data: Buffer,
  contentType: string
): number {
  const mimeTypeSize = contentType.length;
  const dataSize = data.length;
  const maxChunkSize = 520;

  let size = 2 + mimeTypeSize + 1; // OP_FALSE OP_IF + mime type + OP_0

  for (let i = 0; i < dataSize; i += maxChunkSize) {
    size += Math.min(maxChunkSize, dataSize - i) + 1; // Add 1 for the push opcode
  }

  size += 1; // OP_ENDIF
  return Math.ceil(size / 4);
}

export function getEstimatedFee(
  fileSize: number[],
  mimeTypeByteSize: number[],
  serviceFee: number,
  feeRate: number,
  price: number = 0
) {
  const dustLimit = 546;
  let amount = 0;
  if (fileSize.length !== mimeTypeByteSize.length) {
    throw new Error("File size and mime type size must be the same length.");
  }
  let totalCommitFee = 0;
  let totalRevealFee = 0;
  for (let i = 0; i < fileSize.length; i++) {
    let commitSize = 0;
    if (price > 0) {
      commitSize = Math.ceil(10 + 58 * 2 + 43 * 3);
    } else {
      commitSize = Math.ceil(10 + 58 * 1 + 43 * 3);
    }

    const inscriptionSize =
      (33 +
        1 +
        1 +
        1 +
        4 +
        2 +
        1 +
        mimeTypeByteSize[i] +
        2 +
        Math.ceil(fileSize[i] / 520) +
        fileSize[i] +
        1 +
        10) /
      WITNESS_SCALE_FACTOR;
    const revealSize = Math.ceil(10 + 58 * 1 + 43 * 1 + inscriptionSize);
    const commitFee = commitSize * feeRate;
    const revealFee = revealSize * feeRate;
    totalCommitFee += commitFee;
    totalRevealFee += revealFee;
    amount += commitFee + revealFee + dustLimit + serviceFee;
  }
  amount += price;
  return {
    estimatedFee: {
      feeRate: feeRate,
      price: price,
      networkFee: amount - price - serviceFee * fileSize.length,
      serviceFee: serviceFee * fileSize.length,
      commitFee: totalCommitFee,
      revealFee: totalRevealFee,
      totalAmount: amount,
    },
  };
}
