import { NextResponse } from 'next/server';
import { SymbolFacade, Network, Address } from 'symbol-sdk/symbol';
import { PrivateKey } from 'symbol-sdk';
import { NODE_URL, EPOCH_ADJUSTMENT } from '../../lib/constants';

const NETWORK_TYPE = Network.TESTNET;
const facade = new SymbolFacade(NETWORK_TYPE);

// いいね送金額（0.1 XYM = 100000 micro XYM）
const LIKE_AMOUNT = 100000n;
// XYMのモザイクID
const XYM_MOSAIC_ID = 0x72C0212E67A08BCEn;

function createDeadline() {
  const now = Math.floor(Date.now() / 1000);
  return BigInt((now - EPOCH_ADJUSTMENT + 7200) * 1000);
}

export async function POST(request: Request) {
  try {
    const { privateKey: privateKeyHex, recipientAddress, postHash } = await request.json();

    if (!privateKeyHex || !recipientAddress || !postHash) {
      return NextResponse.json(
        { error: 'Missing privateKey, recipientAddress, or postHash' },
        { status: 400 }
      );
    }

    const privateKey = new PrivateKey(privateKeyHex);
    const keyPair = new facade.static.KeyPair(privateKey);
    const recipient = new Address(recipientAddress);

    // いいねメッセージ（投稿のハッシュを含める）
    const likeMessage = `LIKE:${postHash}`;

    const tx = facade.transactionFactory.create({
      type: 'transfer_transaction_v1',
      signerPublicKey: keyPair.publicKey,
      deadline: createDeadline(),
      recipientAddress: recipient,
      mosaics: [
        { mosaicId: XYM_MOSAIC_ID, amount: LIKE_AMOUNT }
      ],
      message: new Uint8Array([0, ...new TextEncoder().encode(likeMessage)]),
      fee: 1000000n,
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

    return NextResponse.json({ hash, amount: '0.1' });
  } catch (error) {
    console.error('Like error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
