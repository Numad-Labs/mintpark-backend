export function calculateTaprootTxSize(
  inputs: number,
  outputs: number
): number {
  const BASE_TX_SIZE = 10.5;
  const TAPROOT_INPUT_SIZE = 57.5;
  const TAPROOT_OUTPUT_SIZE = 43;

  return (
    BASE_TX_SIZE + inputs * TAPROOT_INPUT_SIZE + outputs * TAPROOT_OUTPUT_SIZE
  );
}

export function calculateFeeForOrderSplitTx(
  inputs: number,
  outputs: number,
  feeRate: number
): number {
  const txSize = calculateTaprootTxSize(inputs, outputs);
  return Math.ceil(txSize * feeRate);
}
