import http from "k6/http";
import { check, group, sleep } from "k6";
import { randomBytes, sha256 } from "k6/crypto";

// Configuration
const BASE_URL = __ENV.BASE_URL || "https://api.yourdomain.com";
const NUM_USERS = parseInt(__ENV.NUM_USERS || "50");
const RAMP_UP_TIME = parseInt(__ENV.RAMP_UP_TIME || "30");
const TEST_DURATION = parseInt(__ENV.TEST_DURATION || "300");

const layerId = "b5e6c3a6-9ddf-45fe-b67d-88a7046d6db3";
const launchId = "";

// Hardhat test wallets
const TEST_WALLETS = [
  {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    privateKey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  },
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    privateKey:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
  }
];

// Helper function to convert hex to Uint8Array
function hexToBytes(hex) {
  hex = hex.replace("0x", "");
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const hexByte = hex.substr(i * 2, 2);
    bytes[i] = parseInt(hexByte, 16);
  }
  return bytes;
}

// Helper function to convert bytes to hex string
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Function to sign Ethereum personal message
function signPersonalMessage(message, privateKey) {
  // Remove '0x' prefix if present
  const cleanPrivateKey = privateKey.startsWith("0x")
    ? privateKey.slice(2)
    : privateKey;

  // Add Ethereum signed message prefix
  const PREFIX = "\x19Ethereum Signed Message:\n";
  const messageLength = message.length.toString();
  const prefixedMessage = PREFIX + messageLength + message;

  // Hash the prefixed message
  const messageHash = sha256(prefixedMessage, "hex");

  // Create signature components (this is a simplified version)
  // In production, you would use proper ECC signing
  const signatureBase = sha256(messageHash + cleanPrivateKey, "hex");

  // Generate r, s components from the signature base
  const r = signatureBase.slice(0, 32);
  const s = signatureBase.slice(32, 64);
  // Add recovery value v (either 27 or 28)
  const v = new Uint8Array([27 + (signatureBase[63] % 2)]);

  // Return the signature in the format expected by Ethereum
  return "0x" + bytesToHex(r) + bytesToHex(s) + bytesToHex(v);
}

// Function to sign Ethereum transaction
function signTransaction(unsignedTxHex, privateKey) {
  // Remove '0x' prefix if present
  const cleanPrivateKey = privateKey.startsWith("0x")
    ? privateKey.slice(2)
    : privateKey;

  // Hash the unsigned transaction
  const txHash = sha256(hexToBytes(unsignedTxHex), "hex");

  // Sign the transaction hash (simplified for testing)
  const signatureBase = sha256(txHash + cleanPrivateKey, "hex");

  // Generate signature components
  const r = signatureBase.slice(0, 32);
  const s = signatureBase.slice(32, 64);
  const v = new Uint8Array([27 + (signatureBase[63] % 2)]);

  return {
    signedTx: unsignedTxHex + bytesToHex(r) + bytesToHex(s) + bytesToHex(v),
    txid: "0x" + bytesToHex(txHash)
  };
}

// Generate message to sign
function generateMessageToSign(wallet) {
  const payload = JSON.stringify({
    address: wallet.address
  });

  const response = http.post(`${BASE_URL}/users/generate-message`, payload, {
    headers: { "Content-Type": "application/json" }
  });

  check(response, {
    "message generation status is 200": (r) => r.status === 200,
    "message returned": (r) => JSON.parse(r.body).data.message
  });

  const message = JSON.parse(response.body).data.message;
  const signedMessage = signPersonalMessage(message, wallet.privateKey);

  return { message, signedMessage };
}

// Login with signed message
function loginUser(wallet, signedMessage, layerId) {
  const payload = JSON.stringify({
    address: wallet.address,
    signedMessage: signedMessage,
    layerId: layerId
  });

  const response = http.post(`${BASE_URL}/users/login`, payload, {
    headers: { "Content-Type": "application/json" }
  });

  check(response, {
    "login status is 200": (r) => r.status === 200,
    "token returned": (r) => {
      const data = JSON.parse(r.body).data;
      return data.auth && data.auth.accessToken && data.userLayer;
    }
  });

  return {
    token: JSON.parse(response.body).data.auth.accessToken,
    userLayerId: JSON.parse(response.body).data.userLayer.id
  };
}

// Get active layers
function getLayers() {
  const response = http.get(`${BASE_URL}/layers`);

  check(response, {
    "layers status is 200": (r) => r.status === 200,
    "layers returned data": (r) => JSON.parse(r.body).data.length > 0
  });

  return JSON.parse(response.body).data;
}

// Authentication helper
function authenticateUser(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
  };
}

// Buy launch item
function buyLaunchItem(token, launchId, userLayerId) {
  const params = authenticateUser(token);
  const payload = JSON.stringify({
    userLayerId: userLayerId,
    feeRate: 1
  });

  const response = http.post(`${BASE_URL}/launchpad/${launchId}/buy`, payload, {
    ...params,
    headers: {
      ...params.headers,
      "Content-Type": "application/json"
    }
  });

  check(response, {
    "buy launch item status is 200": (r) => r.status === 200,
    "unsigned tx returned": (r) => {
      const data = JSON.parse(r.body).data;
      return data.launchItem && data.order && data.singleMintTxHex;
    }
  });

  return JSON.parse(response.body).data;
}

// Mint launch item
function mintLaunchItem(token, launchItemId, userLayerId, signedTx, orderId) {
  const params = authenticateUser(token);
  const payload = JSON.stringify({
    launchItemId,
    userLayerId,
    signedTx,
    orderId
  });

  const response = http.post(`${BASE_URL}/launchpad/mint`, payload, {
    ...params,
    headers: {
      ...params.headers,
      "Content-Type": "application/json"
    }
  });

  check(response, {
    "mint launch item status is 200": (r) => r.status === 200,
    "minted item returned": (r) => {
      const data = JSON.parse(r.body).data;
      return data.launchItem && data.collectible;
    }
  });

  return JSON.parse(response.body).data;
}

// Main test scenario
export default function () {
  // Select a random wallet from the test wallets
  const walletIndex = Math.floor(Math.random() * TEST_WALLETS.length);
  const wallet = TEST_WALLETS[walletIndex];

  // Generate message and sign it for authentication
  const { message, signedMessage } = generateMessageToSign(wallet);

  // Login with the signed message
  const { token, userLayerId } = loginUser(wallet, signedMessage, layerId);

  // Get active launches
  // const launches = getActiveLaunches(
  //   token,
  //   "04b493ef-8242-4736-9de1-852d21a4dc28"
  // );

  // if (!launches || launches.length === 0) {
  //   console.log("No active launches available");
  //   return;
  // }

  // Buy launch item and get unsigned transaction
  const buyResult = buyLaunchItem(token, launchId, userLayerId);

  // Sign the transaction with the wallet's private key
  const { signedTx, txid } = signTransaction(
    buyResult.singleMintTxHex,
    wallet.privateKey
  );

  // Small delay to simulate blockchain confirmation
  sleep(1);

  // Mint launch item with signed transaction
  const mintResult = mintLaunchItem(
    token,
    buyResult.launchItem.id,
    userLayerId,
    signedTx,
    buyResult.order.id
  );

  // Validate results
  check(mintResult, {
    "launch item minted successfully": (r) => r.launchItem && r.collectible
  });

  // Sleep to simulate user interaction
  sleep(1);
}

// Configuration options
export const options = {
  stages: [
    { duration: `${RAMP_UP_TIME}s`, target: NUM_USERS },
    { duration: `${TEST_DURATION}s`, target: NUM_USERS },
    { duration: "30s", target: 0 }
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.95"]
  }
};
