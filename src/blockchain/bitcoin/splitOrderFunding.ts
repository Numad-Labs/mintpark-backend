import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { ECPairFactory } from "ecpair";
import BIP32Factory from "bip32";
import { CustomError } from "../../exceptions/CustomError";
import { getUtxos } from "./libs";

bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);
const bip32 = BIP32Factory(ecc);

function toXOnly(pubkey: Buffer): Buffer {
    return pubkey.slice(1, 33);
}

export async function splitOrderFunding(data: { addresses: string[], amount: number, fundingAddress: string, fundingPrivateKey: string }) {
    const { addresses, amount, fundingAddress, fundingPrivateKey } = data;
    const network = bitcoin.networks.testnet

    const keyPair = ECPair.fromPrivateKey(Buffer.from(fundingPrivateKey, "hex"), {
        network
    });
    const privateKey = keyPair.privateKey!;
    if (!privateKey) {
        throw new CustomError("Invalid private key", 400);
    }
    const node = bip32.fromPrivateKey(privateKey, Buffer.alloc(32), network);
    const pubkey = node.publicKey;
    const internalPubKey = toXOnly(pubkey);

    const utxos = await getUtxos(fundingAddress);
    if (!utxos || utxos.length === 0) {
        throw new CustomError("Not funded. Utxos not found.", 400);
    }

    const psbt = new bitcoin.Psbt({ network: network });
    for (let i = 0; i < utxos.length; i++) {
        const utxo = utxos[i];
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

    for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        psbt.addOutput({
            address,
            value: BigInt(amount)
        });
    }


    const tweakedSigner = node.tweak(
        Buffer.from(bitcoin.crypto.taggedHash("TapTweak", toXOnly(node.publicKey)))
    );
    for (let i = 0; i < psbt.data.inputs.length; i++) {
        psbt.signInput(i, tweakedSigner);
    }

    const tx = psbt.finalizeAllInputs().extractTransaction(false);
    const txHex = tx.toHex();

    return txHex;
}