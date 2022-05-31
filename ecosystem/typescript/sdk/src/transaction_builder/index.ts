import * as SHA3 from "js-sha3";
import { HexString } from "../hex_string";
import {
  AccountAddress,
  Ed25519PublicKey,
  Ed25519Signature,
  RawTransaction,
  SignedTransaction,
  TransactionAuthenticatorVariantEd25519,
} from "./aptos_types";
import { BcsSerializer } from "./bcs";

const SALT = "APTOS::RawTransaction";

export type SigningMessage = Buffer;
export type TransactionSignature = Uint8Array;

/** Function that takes in a Signing Message (serialized raw transaction)
 *  and returns a signature
 */
export type SigningFn = (txn: SigningMessage) => Promise<TransactionSignature>;

class TransactionBuilder<F extends SigningFn> {
  private signingFunction: F;

  private publicKey: Uint8Array;

  constructor(signingFunction: F, publicKey: Uint8Array) {
    this.signingFunction = signingFunction;
    this.publicKey = publicKey;
  }

  /** Generates a Signing Message out of a raw transaction. */
  static async getSigningMessage(rawTxn: RawTransaction): Promise<SigningMessage> {
    const hash = SHA3.sha3_256.create();
    hash.update(Buffer.from(SALT));

    const prefix = new Uint8Array(hash.arrayBuffer());

    const serializer = new BcsSerializer();
    rawTxn.serialize(serializer);

    return Buffer.from([...prefix, ...serializer.getBytes()]);
  }

  private async signInternal(rawTxn: RawTransaction): Promise<SignedTransaction> {
    const signingMessage = await TransactionBuilder.getSigningMessage(rawTxn);
    const signatureRaw = await this.signingFunction(signingMessage);

    const signature = new Ed25519Signature(signatureRaw);

    const authenticator = new TransactionAuthenticatorVariantEd25519(new Ed25519PublicKey(this.publicKey), signature);

    return new SignedTransaction(rawTxn, authenticator);
  }

  /** Signs a raw transaction and returns a bcs serialized transaction. */
  async sign(rawTxn: RawTransaction): Promise<Uint8Array> {
    const signedTxn = await this.signInternal(rawTxn);

    const signedTxnSerializer = new BcsSerializer();
    signedTxn.serialize(signedTxnSerializer);

    return signedTxnSerializer.getBytes();
  }
}

/** Just a syntatic sugar.
 *  TODO: add default signing function for Ed25519 */
export class TransactionBuilderEd25519 extends TransactionBuilder<SigningFn> {}