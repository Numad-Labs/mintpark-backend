import fs from "fs/promises";
import { userRepository } from "./repositories/userRepository";
import { orderRepository } from "./repositories/orderRepostory";

type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";
type LayerType = "BITCOIN" | "FRACTAL" | "CITREA";
type NetworkType = "MAINNET" | "TESTNET";

interface UserData {
  id: string;
  role: UserRole;
  createdAt: Date;
  address: string;
  pubkey: string | null;
  xpub: string | null;
  layerId: string;
  layer: LayerType;
  network: NetworkType;
}

interface Order {
  id: string;
  userId: string;
  // ... other order fields
}

interface CombinedData {
  address: string;
  userLayerId: string;
  userId: string;
  orderId: string;
}

async function processCombinedData(
  userRepository: {
    getByAddressAndLayerId: (
      address: string,
      layerId: string
    ) => Promise<UserData | undefined>;
  },
  orderRepository: {
    getByUserId: (userId: string) => Promise<Order[]>;
  },
  layerIds: string[] // Array of layer IDs to check for each address
) {
  try {
    // Read the unique addresses
    const fileContent = await fs.readFile("unique-feepayers.json", "utf8");
    const addresses: string[] = JSON.parse(fileContent);

    console.log(`Processing ${addresses.length} unique addresses...`);

    const combinedData: CombinedData[] = [];

    // Process each address
    for (const address of addresses) {
      // Check each layer ID for the address
      for (const layerId of layerIds) {
        // Get user data
        const userData = await userRepository.getByAddressAndLayerId(
          address,
          layerId
        );

        if (!userData) {
          continue; // Skip if no user found
        }

        // Get orders for the user
        const orders = await orderRepository.getByUserId(userData.id);

        if (!orders || orders.length === 0) {
          continue; // Skip if no orders found
        }
        const latestOrder = orders[0];

        // Add entry for each order
        // for (const order of orders) {
        combinedData.push({
          address: address,
          userLayerId: userData.layerId,
          userId: userData.id,
          orderId: latestOrder.id
        });
        // }
      }
    }

    // Save the combined data to a new file
    const outputJson = JSON.stringify(combinedData, null, 2);
    await fs.writeFile("combined-data-airdrop.json", outputJson);

    console.log(
      `Processing complete. Total combined entries: ${combinedData.length}`
    );
    return combinedData;
  } catch (error) {
    console.error("Error processing data:", error);
    throw error;
  }
}

// Example usage:
async function main() {
  const layerIds = ["aa8444d9-d688-42a9-8fb9-3be04d333a4e"];

  const result = await processCombinedData(
    userRepository,
    orderRepository,
    layerIds
  );

  console.log(`Successfully processed ${result.length} entries`);
}

// Run the process
main().catch(console.error);
