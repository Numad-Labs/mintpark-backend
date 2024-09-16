export function generateMessage(address: string, nonce: string) {
  const message = `Wallet address: ${address}, Nonce: ${nonce}`;

  return message;
}
