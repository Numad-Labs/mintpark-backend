import http from "k6/http";
import { check, group, sleep } from "k6";
import { randomBytes, sha256 } from "k6/crypto";

// Configuration and environment variables
const BASE_URL = __ENV.BASE_URL || "https://api.yourdomain.com";
const NUM_USERS = parseInt(__ENV.NUM_USERS || "50");
const TEST_DURATION = parseInt(__ENV.TEST_DURATION || "300");

// Utility functions
function randomString(length) {
  const bytes = randomBytes(length);
  return bytesToHex(bytes);
}

function randomSleep(minSeconds = 0.2, maxSeconds = 3) {
  const sleepTime = Math.random() * (maxSeconds - minSeconds) + minSeconds;
  sleep(sleepTime);
}

function randomIntBetween(min, max) {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const randomVal = parseInt(bytesToHex(randomBytes(bytesNeeded)), 16);
  return min + (randomVal % range);
}

// Helper function to convert bytes to hex string
function bytesToHex(bytes) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateRandomWalletAddress() {
  // Start with '0x' prefix
  let address = "0x";

  // Generate 40 random hexadecimal characters
  const hexChars = "0123456789abcdef";
  for (let i = 0; i < 40; i++) {
    const randomIndex = Math.floor(Math.random() * hexChars.length);
    address += hexChars[randomIndex];
  }

  return address;
}
// Generate a random wallet-like structure
export function generateWallet() {
  // Generate a random 32-byte private key
  const privateKeyBytes = randomBytes(32);
  const privateKey = bytesToHex(privateKeyBytes);

  // Generate a deterministic address from the private key
  // In a real implementation, this would use proper key derivation
  // For testing purposes, we'll use a hash of the private key
  const addressBytes = sha256(hexToBytes(privateKey), "hex");
  // Take the last 20 bytes (40 characters) for the address
  const address = "0x" + bytesToHex(addressBytes.slice(12, 32));

  return {
    address: generateRandomWalletAddress(),
    privateKey: "0x" + privateKey // Adding 0x prefix for consistency
  };
}

// Mock signing function using sha256
export function mockSignMessage(message, privateKey) {
  // Remove '0x' prefix if present for consistency
  const cleanPrivateKey = privateKey.startsWith("0x")
    ? privateKey.slice(2)
    : privateKey;

  // Create a more realistic signature structure
  // Real signatures are 65 bytes: r (32 bytes) + s (32 bytes) + v (1 byte)
  const messageHash = sha256(message, "hex");
  const signatureBase = sha256(messageHash + cleanPrivateKey, "hex");

  // Generate r, s components from the signature base
  const r = signatureBase.slice(0, 32);
  const s = signatureBase.slice(32, 64);
  // Add recovery value v (either 27 or 28)
  const v = new Uint8Array([27 + (signatureBase[63] % 2)]);

  // Combine components into final signature
  return "0x" + bytesToHex(r) + bytesToHex(s) + bytesToHex(v);
}

// Helper function to convert hex to Uint8Array
export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const hexByte = hex.substr(i * 2, 2);
    bytes[i] = parseInt(hexByte, 16);
  }
  return bytes;
}

// Test scenarios configuration - no ramping logic
export const options = {
  vus: NUM_USERS, // Start with NUM_USERS immediately
  duration: `${TEST_DURATION}s`, // Run for TEST_DURATION seconds
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests must complete under 500ms
    http_req_failed: ["rate<0.01"], // Less than 1% request failure rate
    checks: ["rate>0.95"] // At least 95% of checks should pass
  },
  ext: {
    loadimpact: {
      projectID: 3666777 // Optional: Your Load Impact project ID
    }
  }
};

// Replace wallet generation with our custom function
function generateWalletData() {
  return generateWallet();
}

// Replace signing with our mock function
function signMessage(message, privateKey) {
  return mockSignMessage(message, privateKey);
}

// Authentication function to get token
function authenticateUser(token) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    }
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
  const signedMessage = signMessage(message, wallet.privateKey);

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
    "token returned": (r) => JSON.parse(r.body).data.auth.accessToken
  });

  return {
    token: JSON.parse(response.body).data.auth.accessToken,
    userLayerId: JSON.parse(response.body).data.userLayer.id
  };
}

// Get active layers
function getLayers() {
  // const params = authenticateUser(token);
  const response = http.get(`${BASE_URL}/layers`);

  check(response, {
    "layers status is 200": (r) => r.status === 200,
    "layers returned data": (r) => JSON.parse(r.body).data.length > 0
  });

  return JSON.parse(response.body).data;
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

  console.log(`buyres ${response.status}`);
  if (response.status >= 400) {
    console.log(JSON.parse(response.body));
  }

  check(response, {
    "buy launch item status is 200": (r) => r.status === 200,
    "launch item returned": (r) => {
      const data = JSON.parse(r.body).data;
      return data.launchItem && data.order;
    }
  });

  return JSON.parse(response.body).data;
}

// Mint launch item
function mintLaunchItem(token, launchItemId, userLayerId, txid, orderId) {
  const params = authenticateUser(token);
  const payload = JSON.stringify({
    launchItemId,
    userLayerId,
    txid,
    orderId
  });

  const response = http.post(`${BASE_URL}/launchpad/mint`, payload, {
    ...params,
    headers: {
      ...params.headers,
      "Content-Type": "application/json"
    }
  });
  console.log(`mintres ${response.status}`);

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
  // Generate a simulated wallet
  const wallet = generateWalletData();

  // Get active layers
  let layers;
  // Generate message and login
  layers = getLayers();

  // Generate message and login again (to ensure fresh token)
  const { message: loginMessage, signedMessage: loginSignedMessage } =
    generateMessageToSign(wallet);
  const { token, userLayerId } = loginUser(
    wallet,
    loginSignedMessage,
    "04b493ef-8242-4736-9de1-852d21a4dc28"
  );

  randomSleep(0.3, 0.6);

  const selectedLaunch = { launchId: "ee71bfb0-3098-4e48-a64c-f9f3f4663e0d" };

  randomSleep(0.3, 0.6);

  // Buy launch item
  const buyResult = buyLaunchItem(token, selectedLaunch.launchId, userLayerId);

  // Simulate transaction signing
  const mockTxid = `0x957903e42e0d7ef7126bdb726de6e265630166b5ed634657de476c063540b68d`;

  randomSleep(0.3, 0.6);
  // Mint launch item
  const mintResult = mintLaunchItem(
    token,
    buyResult.launchItem.id,
    userLayerId,
    mockTxid,
    buyResult.order.id
  );

  // // Validate results
  // check(mintResult, {
  //   "launch item minted successfully": (r) => r.launchItem && r.collectible
  // });

  // Small sleep to simulate user interaction
  sleep(0.5);
}

// Teardown function for any cleanup
export function teardown(data) {
  // Optional cleanup or final reporting
  console.log("Performance test completed");
}
