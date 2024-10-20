import { WITNESS_SCALE_FACTOR, DUST_THRESHOLD } from "./constants";

function calculateInscriptionSize(
  fileSize: number,
  mimeTypeByteSize: number
): number {
  return Math.ceil(
    (33 + // Internal pubkey
      1 + // OP_CHECKSIG
      1 + // OP_FALSE
      1 + // OP_IF
      4 + // OP_PUSH(3) + "ord"
      2 + // OP_PUSH(1) + version
      1 + // OP_PUSH(mime type length)
      mimeTypeByteSize +
      2 + // OP_PUSH(file size)
      Math.ceil(fileSize / 520) + // Number of 520-byte chunks
      fileSize +
      1 + // OP_ENDIF
      10) / // Tapscript overhead
      WITNESS_SCALE_FACTOR
  );
}

//TODO: adjutst
export function getEstimatedFee(
  fileSize: number[],
  mimeTypeByteSize: number[],
  serviceFee: number,
  feeRate: number,
  price: number = 0
) {
  const dustLimit = DUST_THRESHOLD;
  if (fileSize.length !== mimeTypeByteSize.length) {
    throw new Error("File size and mime type size must be the same length.");
  }

  let totalAmount = 0;
  let totalCommitFee = 0;
  let totalRevealFee = 0;
  let totalServiceFee = serviceFee * fileSize.length;

  for (let i = 0; i < fileSize.length; i++) {
    const commitInputSize = 58; // Assuming 1 input
    const commitOutputSize = price > 0 ? 43 * 3 : 43 * 2; // Reveal output + change (+ price output if applicable)
    const commitOverhead = 10; // tx version, locktime, etc.
    const commitSize = commitInputSize + commitOutputSize + commitOverhead;

    const inscriptionSize = calculateInscriptionSize(
      fileSize[i],
      mimeTypeByteSize[i]
    );
    const revealSize = Math.ceil(10 + 58 * 1 + 43 * 1 + 10 + inscriptionSize);
    const commitFee = commitSize * feeRate;
    const revealFee = revealSize * feeRate;
    totalCommitFee += commitFee;
    totalRevealFee += revealFee;
    totalAmount += commitFee + revealFee + dustLimit;
  }
  totalAmount += price + totalServiceFee; // dustlimit for last change output
  return {
    estimatedFee: {
      feeRate: feeRate,
      price: price,
      networkFee: totalAmount - price - totalServiceFee,
      serviceFee: totalServiceFee,
      commitFee: totalCommitFee,
      revealFee: totalRevealFee,
      totalAmount: totalAmount,
    },
  };
}
