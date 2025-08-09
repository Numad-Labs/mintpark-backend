import { CustomError } from "@exceptions/CustomError";
import BIP32Factory from "bip32";
import * as bitcoin from "bitcoinjs-lib";
import { ECPairFactory } from "ecpair";
import * as ecc from "tiny-secp256k1";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

function toXOnly(pubkey: Buffer): Buffer {
  return pubkey.slice(1, 33);
}

// Type definitions
export type NetworkType = "mainnet" | "testnet";
export type FeeRateType = "economy" | "normal" | "priority";
export type AddressType = "p2pkh" | "p2sh" | "p2wpkh" | "p2wsh" | "p2tr";

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status?: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

export interface Output {
  address: string;
  amount: number;
}

export interface AddressInfo {
  type: AddressType;
  script?: Buffer;
  version?: number;
  witnessVersion?: number;
  witnessProgram?: Uint8Array;
}

export interface PSBTConfig {
  fundingAddress: string;
  privateKey: string;
  outputs: Output[];
  utxos: UTXO[];
  feeRate?: FeeRateType | number;
  changeAddress?: string | null;
}

export interface PSBTResult {
  psbt: string;
  hex: string;
  txid: string;
  fee: number;
  virtualSize: number;
  weight: number;
  inputs: number;
  outputs: number;
  changeAmount: number;
}

export interface FeeRates {
  economy: number;
  normal: number;
  priority: number;
}

export interface UTXOSelection {
  selectedUtxos: UTXO[];
  fee: number;
  totalInput: number;
}

export interface NetworkConfig {
  network: bitcoin.Network;
  apiEndpoints: {
    broadcast: string;
    utxo: string;
    transaction: string;
    fees: string;
    address: string;
  };
}

export class PSBTBuilder {
  private network: bitcoin.Network;
  private networkType: NetworkType;
  private feeRates: FeeRates;
  private networkConfig: NetworkConfig;

  constructor(networkType: NetworkType = "mainnet") {
    this.networkType = networkType;
    this.network = this.getNetwork(networkType);
    this.networkConfig = this.getNetworkConfig(networkType);

    // Default fee rates (sat/vByte)
    this.feeRates = {
      economy: 1,
      normal: 1,
      priority: 1
    };
  }

  /**
   * Get Bitcoin network configuration
   */
  private getNetwork(networkType: NetworkType): bitcoin.Network {
    return networkType === "mainnet"
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;
  }

  /**
   * Get network-specific configuration
   */
  private getNetworkConfig(networkType: NetworkType): NetworkConfig {
    if (networkType === "mainnet") {
      return {
        network: bitcoin.networks.bitcoin,
        apiEndpoints: {
          broadcast: "https://mempool.space/api/tx",
          utxo: "https://mempool.space/api/address",
          transaction: "https://mempool.space/api/tx",
          fees: "https://mempool.space/api/v1/fees/recommended",
          address: "https://mempool.space/api/address"
        }
      };
    } else {
      return {
        network: bitcoin.networks.testnet,
        apiEndpoints: {
          broadcast: "https://mempool.space/testnet4/api/tx",
          utxo: "https://mempool.space/testnet4/api/address",
          transaction: "https://mempool.space/testnet4/api/tx",
          fees: "https://mempool.space/testnet4/api/v1/fees/recommended",
          address: "https://mempool.space/testnet4/api/address"
        }
      };
    }
  }

  /**
   * Update fee rates
   */
  private setFeeRates(rates: Partial<FeeRates>): void {
    this.feeRates = { ...this.feeRates, ...rates };
  }

  /**
   * Get current network type
   */
  public getNetworkType(): NetworkType {
    return this.networkType;
  }

  /**
   * Create a PSBT transaction
   */
  async generateTxHex({
    fundingAddress,
    fundingPrivateKey,
    outputs,
    feeRate
  }: {
    fundingAddress: string;
    fundingPrivateKey: string;
    outputs: { address: string; amount: number }[];
    feeRate: number;
  }) {
    if (this.getAddressInfo(fundingAddress).type !== "p2tr")
      throw new CustomError("Please provide p2tr address", 400);
    outputs.forEach((output) => {
      if (this.getAddressInfo(output.address).type !== "p2tr")
        throw new CustomError("Please provide p2tr address", 400);
    });
    if (feeRate < 1) throw new CustomError("Fee too low", 400);

    const network = this.network;
    console.log(Buffer.from(fundingPrivateKey, "hex"));
    const keyPair = ECPair.fromPrivateKey(
      Buffer.from(fundingPrivateKey, "hex"),
      {
        network
      }
    );
    const privateKey = keyPair.privateKey!;
    if (!privateKey) {
      throw new Error("Invalid private key");
    }
    const node = bip32.fromPrivateKey(privateKey, Buffer.alloc(32), network);
    const pubkey = node.publicKey;
    const internalPubKey = toXOnly(pubkey);

    const utxos = await this.fetchUTXOs(fundingAddress);
    if (!utxos || utxos.length === 0) {
      throw new Error("Not funded. Utxos not found.");
    }

    const totalOutput = outputs.reduce((sum, output) => sum + output.amount, 0);

    const { selectedUtxos, fee, totalInput } = await this.selectUTXOs(
      utxos,
      totalOutput,
      feeRate,
      outputs.length,
      "p2tr"
    );

    const psbt = new bitcoin.Psbt({ network: network });
    for (let utxo of selectedUtxos) {
      const p2tr = bitcoin.payments.p2tr({
        internalPubkey: internalPubKey,
        network: network
      });
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: p2tr.output!,
          value: BigInt(utxo.value)
        },
        tapInternalKey: internalPubKey,
        sequence: 0xfffffffd
      });
    }

    for (let output of outputs) {
      psbt.addOutput({
        address: output.address,
        value: BigInt(output.amount)
      });
    }

    const changeAmount = totalInput - totalOutput - fee;
    if (changeAmount > 546)
      psbt.addOutput({
        address: fundingAddress,
        value: BigInt(changeAmount)
      });

    const tweakedSigner = node.tweak(
      Buffer.from(
        bitcoin.crypto.taggedHash("TapTweak", toXOnly(node.publicKey))
      )
    );
    for (let i = 0; i < psbt.data.inputs.length; i++) {
      psbt.signInput(i, tweakedSigner);
    }

    const tx = psbt.finalizeAllInputs().extractTransaction(false);
    const txHex = tx.toHex();

    return txHex;
  }

  /**
   * Get address type and script information
   */
  public getAddressInfo(address: string): AddressInfo {
    try {
      // Try base58 addresses (P2PKH and P2SH)
      const decoded = bitcoin.address.fromBase58Check(address);

      // P2PKH (Legacy)
      if (decoded.version === this.network.pubKeyHash) {
        return {
          type: "p2pkh",
          version: decoded.version
        };
      }

      // P2SH (including P2SH-P2WPKH)
      if (decoded.version === this.network.scriptHash) {
        return {
          type: "p2sh",
          version: decoded.version
        };
      }
    } catch (e) {
      // Try Bech32 for native SegWit
      try {
        const decoded = bitcoin.address.fromBech32(address);

        // P2WPKH (Native SegWit v0)
        if (decoded.version === 0 && decoded.data.length === 20) {
          return {
            type: "p2wpkh",
            witnessVersion: decoded.version,
            witnessProgram: decoded.data // This is Uint8Array
          };
        }

        // P2WSH (Native SegWit v0)
        if (decoded.version === 0 && decoded.data.length === 32) {
          return {
            type: "p2wsh",
            witnessVersion: decoded.version,
            witnessProgram: decoded.data // This is Uint8Array
          };
        }

        // P2TR (Taproot)
        if (decoded.version === 1 && decoded.data.length === 32) {
          return {
            type: "p2tr",
            witnessVersion: decoded.version,
            witnessProgram: decoded.data // This is Uint8Array
          };
        }
      } catch (e) {
        throw new Error("Unsupported address format");
      }
    }

    throw new Error("Unable to determine address type");
  }

  /**
   * Select UTXOs using improved coin selection algorithm
   */
  private selectUTXOs(
    utxos: UTXO[],
    targetAmount: number,
    satPerByte: number,
    outputCount: number,
    addressType: AddressType
  ): UTXOSelection {
    // Sort UTXOs by value (largest first for now)
    const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);

    const selectedUtxos: UTXO[] = [];
    let totalInput = 0;
    let estimatedSize = this.estimateBaseSize(outputCount, addressType);

    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      totalInput += utxo.value;

      // Update size estimation with new input
      estimatedSize += this.getInputSize(addressType);

      // Calculate required fee
      const estimatedFee = Math.ceil(estimatedSize * satPerByte);

      // Check if we have enough
      if (totalInput >= targetAmount + estimatedFee) {
        // Add change output to size if needed
        const changeAmount = totalInput - targetAmount - estimatedFee;
        const dustThreshold = 546;

        if (changeAmount > dustThreshold) {
          estimatedSize += this.getOutputSize(addressType);
          const finalFee = Math.ceil(estimatedSize * satPerByte);

          // Recheck with change output included
          if (totalInput >= targetAmount + finalFee) {
            return {
              selectedUtxos,
              fee: finalFee,
              totalInput
            };
          }
        } else {
          return {
            selectedUtxos,
            fee: estimatedFee,
            totalInput
          };
        }
      }
    }

    throw new Error("Insufficient funds for transaction");
  }

  /**
   * Get input size for different address types (in vBytes)
   */
  private getInputSize(addressType: AddressType): number {
    const sizes: Record<AddressType, number> = {
      p2pkh: 148, // Legacy
      p2sh: 91, // P2SH-P2WPKH (most common P2SH)
      p2wpkh: 68, // Native SegWit
      p2wsh: 104, // Native SegWit multisig (approximate)
      p2tr: 58 // Taproot
    };
    return sizes[addressType];
  }

  /**
   * Get output size for different address types (in vBytes)
   */
  private getOutputSize(addressType: AddressType): number {
    const sizes: Record<AddressType, number> = {
      p2pkh: 34, // Legacy
      p2sh: 32, // P2SH
      p2wpkh: 31, // Native SegWit
      p2wsh: 43, // Native SegWit multisig
      p2tr: 43 // Taproot
    };
    return sizes[addressType];
  }

  /**
   * Estimate base transaction size
   */
  private estimateBaseSize(
    outputCount: number,
    addressType: AddressType
  ): number {
    // Base size: version (4) + locktime (4) + input count (1) + output count (1)
    let baseSize = 10;

    // Add output sizes
    baseSize += outputCount * this.getOutputSize(addressType);

    return baseSize;
  }

  /**
   * Fetch recommended fee rates from Mempool API
   */
  public async fetchRecommendedFees(): Promise<FeeRates> {
    const url = this.networkConfig.apiEndpoints.fees;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch fees: ${response.statusText}`);
      }

      const data = await response.json();

      // Mempool returns fastestFee, halfHourFee, hourFee, economyFee, minimumFee
      return {
        economy: data.economyFee || data.hourFee || 1,
        normal: data.halfHourFee || 1,
        priority: data.fastestFee || 1
      };
    } catch (error) {
      console.warn(
        `Error fetching fee rates, using defaults: ${(error as Error).message}`
      );
      return this.feeRates;
    }
  }

  /**
   * Auto-update fee rates from Mempool API
   */
  public async updateFeeRatesFromAPI(): Promise<void> {
    const fees = await this.fetchRecommendedFees();
    this.setFeeRates(fees);
  }

  /**
   * Fetch UTXOs for an address from Mempool API
   */
  public async fetchUTXOs(address: string): Promise<UTXO[]> {
    const url = `${this.networkConfig.apiEndpoints.utxo}/${address}/utxo`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
      }

      const data = await response.json();

      return data.map((utxo: any) => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        address: address,
        status: utxo.status // Mempool provides confirmation status
      }));
    } catch (error) {
      throw new Error(`Error fetching UTXOs: ${(error as Error).message}`);
    }
  }

  /**
   * Fetch raw transaction from Mempool API
   */
  public async fetchRawTransaction(txid: string): Promise<string> {
    const url = `${this.networkConfig.apiEndpoints.transaction}/${txid}/hex`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      throw new Error(
        `Error fetching transaction: ${(error as Error).message}`
      );
    }
  }

  /**
   * Fetch detailed transaction info from Mempool API
   */
  public async fetchTransactionInfo(txid: string): Promise<any> {
    const url = `${this.networkConfig.apiEndpoints.transaction}/${txid}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch transaction info: ${response.statusText}`
        );
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Error fetching transaction info: ${(error as Error).message}`
      );
    }
  }

  /**
   * Fetch address info including balance and transaction count
   */
  public async fetchAddressInfo(address: string): Promise<{
    address: string;
    chain_stats: {
      funded_txo_count: number;
      funded_txo_sum: number;
      spent_txo_count: number;
      spent_txo_sum: number;
      tx_count: number;
    };
    mempool_stats: {
      funded_txo_count: number;
      funded_txo_sum: number;
      spent_txo_count: number;
      spent_txo_sum: number;
      tx_count: number;
    };
  }> {
    const url = `${this.networkConfig.apiEndpoints.address}/${address}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch address info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(
        `Error fetching address info: ${(error as Error).message}`
      );
    }
  }

  /**
   * Get balance for an address (confirmed + unconfirmed)
   */
  public async getBalance(address: string): Promise<{
    confirmed: number;
    unconfirmed: number;
    total: number;
  }> {
    const info = await this.fetchAddressInfo(address);

    const confirmed =
      info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
    const unconfirmed =
      info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum;

    return {
      confirmed,
      unconfirmed,
      total: confirmed + unconfirmed
    };
  }

  /**
   * Broadcast transaction via Mempool API
   */
  public async broadcastTransaction(hexTx: string): Promise<string> {
    try {
      const response = await fetch(this.networkConfig.apiEndpoints.broadcast, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: hexTx
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Broadcast failed: ${error}`);
      }

      const txid = await response.text();
      return txid.trim();
    } catch (error) {
      throw new Error(
        `Error broadcasting transaction: ${(error as Error).message}`
      );
    }
  }

  /**
   * Validate transaction before broadcasting
   */
  public async validateTransaction(hexTx: string): Promise<{
    valid: boolean;
    size: number;
    vsize: number;
    weight: number;
    fee?: number;
    feeRate?: number;
  }> {
    try {
      const tx = bitcoin.Transaction.fromHex(hexTx);

      return {
        valid: true,
        size: tx.byteLength(),
        vsize: tx.virtualSize(),
        weight: tx.weight()
      };
    } catch (error) {
      return {
        valid: false,
        size: 0,
        vsize: 0,
        weight: 0
      };
    }
  }

  /**
   * Estimate transaction fee for given inputs and outputs
   */
  public estimateFee(
    inputCount: number,
    outputCount: number,
    addressType: AddressType,
    feeRate: FeeRateType | number = "normal"
  ): number {
    const satPerByte =
      typeof feeRate === "number" ? feeRate : this.feeRates[feeRate];

    let size = this.estimateBaseSize(outputCount, addressType);
    size += inputCount * this.getInputSize(addressType);

    return Math.ceil(size * satPerByte);
  }

  public createFundingAddress() {
    const keyPair = ECPair.makeRandom({ network: this.network });

    let address;
    try {
      address = bitcoin.payments.p2tr({
        internalPubkey: toXOnly(keyPair.publicKey),
        network: this.network
      }).address!;
    } catch (error) {
      console.log(error);
      throw new Error("Could not generate funding address and private key.");
    }

    return {
      address,
      publicKey: keyPair.publicKey.toString("hex"),
      privateKey: keyPair.privateKey!.toString("hex")
    };
  }
}

const TestnetPSBTBuilder = new PSBTBuilder("testnet");
const MainnetPSBTBuilder = new PSBTBuilder("mainnet");

export function getPSBTBuilder(networkType: NetworkType): PSBTBuilder {
  if (networkType === "mainnet") return MainnetPSBTBuilder;

  return TestnetPSBTBuilder;
}
