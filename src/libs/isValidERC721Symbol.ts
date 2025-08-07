export function isValidERC721Symbol(symbol: string): boolean {
  const regex = /^[A-Z0-9]{3,10}$/;
  return regex.test(symbol);
}
