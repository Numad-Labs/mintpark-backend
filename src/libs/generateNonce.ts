const crypto = require("crypto");

export function generateNonce(length = 16) {
  return crypto.randomBytes(length).toString("base64");
}
