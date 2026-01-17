import { SymbolFacade, Network } from 'symbol-sdk/symbol';
import { PrivateKey } from 'symbol-sdk';

// Symbolテストネット設定
export const NETWORK_TYPE = Network.TESTNET;
export const NODE_URL = 'https://sym-test-01.opening-line.jp:3001';
export const GENERATION_HASH = '49D6E1CE276A85B70EAFE52349AACCA389302E7A9754BCF1221E79494FC665A4';
export const EPOCH_ADJUSTMENT = 1667250467;
export const CURRENCY_MOSAIC_ID = '72C0212E67A08BCE';

// Facade初期化
export const facade = new SymbolFacade(NETWORK_TYPE);

// 新規アカウント生成
export function generateAccount() {
  const privateKey = PrivateKey.random();
  const keyPair = new facade.static.KeyPair(privateKey);
  const address = facade.network.publicKeyToAddress(keyPair.publicKey);

  return {
    privateKey: privateKey.toString(),
    publicKey: keyPair.publicKey.toString(),
    address: address.toString(),
  };
}

// 秘密鍵からアカウント復元
export function restoreAccount(privateKeyHex: string) {
  const privateKey = new PrivateKey(privateKeyHex);
  const keyPair = new facade.static.KeyPair(privateKey);
  const address = facade.network.publicKeyToAddress(keyPair.publicKey);

  return {
    privateKey: privateKey.toString(),
    publicKey: keyPair.publicKey.toString(),
    address: address.toString(),
  };
}

// アドレスのアカウント情報取得
export async function getAccountInfo(address: string) {
  const response = await fetch(`${NODE_URL}/accounts/${address}`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error(`Failed to fetch account: ${response.statusText}`);
  }
  return response.json();
}

// ノードの健全性確認
export async function checkNodeHealth() {
  try {
    const response = await fetch(`${NODE_URL}/node/health`);
    if (!response.ok) {
      return { status: 'error', message: response.statusText };
    }
    const data = await response.json();
    return { status: 'ok', data };
  } catch (error) {
    return { status: 'error', message: String(error) };
  }
}

// トランザクション送信
export async function announceTransaction(signedPayload: string) {
  const response = await fetch(`${NODE_URL}/transactions`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payload: signedPayload }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Transaction failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

// デッドライン作成（2時間後）
export function createDeadline() {
  const now = Math.floor(Date.now() / 1000);
  return BigInt((now - EPOCH_ADJUSTMENT + 7200) * 1000);
}

// 投稿トランザクション作成（自分宛てのメッセージ）
export function createPostTransaction(
  signerPrivateKey: string,
  message: string
) {
  const privateKey = new PrivateKey(signerPrivateKey);
  const keyPair = new facade.static.KeyPair(privateKey);
  const address = facade.network.publicKeyToAddress(keyPair.publicKey);

  const tx = facade.transactionFactory.create({
    type: 'transfer_transaction_v1',
    signerPublicKey: keyPair.publicKey,
    deadline: createDeadline(),
    recipientAddress: address.toString(),
    mosaics: [],
    message: new Uint8Array([0, ...new TextEncoder().encode(message)]),
  });

  const signature = facade.signTransaction(keyPair, tx);
  facade.transactionFactory.static.attachSignature(tx, signature);

  return {
    hash: facade.hashTransaction(tx).toString(),
    payload: Buffer.from(tx.serialize()).toString('hex').toUpperCase(),
  };
}

// いいね（XYM送金）トランザクション作成
export function createLikeTransaction(
  signerPrivateKey: string,
  recipientAddress: string,
  amount: bigint
) {
  const privateKey = new PrivateKey(signerPrivateKey);
  const keyPair = new facade.static.KeyPair(privateKey);

  const tx = facade.transactionFactory.create({
    type: 'transfer_transaction_v1',
    signerPublicKey: keyPair.publicKey,
    deadline: createDeadline(),
    recipientAddress,
    mosaics: [{ mosaicId: BigInt('0x' + CURRENCY_MOSAIC_ID), amount }],
    message: new Uint8Array([0, ...new TextEncoder().encode('UNDO:LIKE')]),
  });

  const signature = facade.signTransaction(keyPair, tx);
  facade.transactionFactory.static.attachSignature(tx, signature);

  return {
    hash: facade.hashTransaction(tx).toString(),
    payload: Buffer.from(tx.serialize()).toString('hex').toUpperCase(),
  };
}

// アドレスの投稿一覧取得
export async function getPosts(address: string) {
  const response = await fetch(
    `${NODE_URL}/transactions/confirmed?address=${address}&type=16724&pageSize=100`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch posts: ${response.statusText}`);
  }
  const data = await response.json();
  return data.data || [];
}

// トランザクションのメッセージをデコード
export function decodeMessage(messageHex: string): string {
  if (!messageHex || messageHex.length < 2) return '';
  const bytes = new Uint8Array(
    messageHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );
  if (bytes[0] !== 0) return '';
  return new TextDecoder().decode(bytes.slice(1));
}

// XYM残高取得
export async function getXymBalance(address: string): Promise<bigint> {
  try {
    const accountInfo = await getAccountInfo(address);
    if (!accountInfo) return 0n;

    const mosaics = accountInfo.account?.mosaics || [];
    const xym = mosaics.find(
      (m: { id: string }) => m.id.toUpperCase() === CURRENCY_MOSAIC_ID.toUpperCase()
    );
    return xym ? BigInt(xym.amount) : 0n;
  } catch {
    return 0n;
  }
}
