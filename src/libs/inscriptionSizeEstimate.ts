export function calculateInscriptionSize(
  contentType: string,
  data: Buffer
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
