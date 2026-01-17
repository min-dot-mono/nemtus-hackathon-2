import { NextResponse } from 'next/server';
import { SymbolFacade, Network } from 'symbol-sdk/symbol';
import { PrivateKey } from 'symbol-sdk';
import { UNDO_CHANNEL_ADDRESS, NODE_URL, EPOCH_ADJUSTMENT } from '../../lib/constants';

const NETWORK_TYPE = Network.TESTNET;

const facade = new SymbolFacade(NETWORK_TYPE);

function createDeadline() {
  const now = Math.floor(Date.now() / 1000);
  return BigInt((now - EPOCH_ADJUSTMENT + 7200) * 1000);
}

// 投稿作成
export async function POST(request: Request) {
  try {
    const { privateKey: privateKeyHex, message } = await request.json();

    if (!privateKeyHex || !message) {
      return NextResponse.json(
        { error: 'Missing privateKey or message' },
        { status: 400 }
      );
    }

    const privateKey = new PrivateKey(privateKeyHex);
    const keyPair = new facade.static.KeyPair(privateKey);

    const tx = facade.transactionFactory.create({
      type: 'transfer_transaction_v1',
      signerPublicKey: keyPair.publicKey,
      deadline: createDeadline(),
      recipientAddress: UNDO_CHANNEL_ADDRESS,
      mosaics: [],
      message: new Uint8Array([0, ...new TextEncoder().encode(message)]),
    });

    const signature = facade.signTransaction(keyPair, tx);
    facade.transactionFactory.static.attachSignature(tx, signature);

    const hash = facade.hashTransaction(tx).toString();
    const payload = Buffer.from(tx.serialize()).toString('hex').toUpperCase();

    // トランザクション送信
    const response = await fetch(`${NODE_URL}/transactions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Transaction failed: ${JSON.stringify(error)}`);
    }

    return NextResponse.json({ hash, payload });
  } catch (error) {
    console.error('Post error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
