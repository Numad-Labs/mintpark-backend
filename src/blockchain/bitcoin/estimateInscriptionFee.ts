export function estimateRecursiveInscriptionVBytes(numItems: number) {
  // Calculate sizes
  const baseSize = 1000;
  const perItemSize = 100;
  const inscriptionSize = baseSize + numItems * perItemSize;

  // Commit transaction (typically ~150-200 vBytes)
  const commitVBytes = 200;

  // Reveal transaction
  const opCodeOverheadVBytes = Math.ceil(inscriptionSize / 520) * 3;
  const revealVBytes =
    Math.ceil(inscriptionSize / 4) + opCodeOverheadVBytes + 200; // Transaction overhead included

  return {
    totalVBytes: commitVBytes + revealVBytes
  };
}

export function estimateRegularInscriptionVBytes(fileSize: number) {
  // For regular inscriptions, the entire file is inscribed
  const inscriptionSize = fileSize;

  // Commit transaction (typically ~150-200 vBytes)
  const commitVBytes = 200;

  // Reveal transaction
  const opCodeOverheadVBytes = Math.ceil(inscriptionSize / 520) * 3;
  const revealVBytes =
    Math.ceil(inscriptionSize / 4) + opCodeOverheadVBytes + 180;

  return {
    totalVBytes: commitVBytes + revealVBytes
  };
}
