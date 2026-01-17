import { NextResponse } from 'next/server';
import { SymbolFacade, Network, generateMosaicId } from 'symbol-sdk/symbol';
import { PrivateKey } from 'symbol-sdk';
import { NODE_URL, EPOCH_ADJUSTMENT } from '../../../lib/constants';

const NETWORK_TYPE = Network.TESTNET;
const facade = new SymbolFacade(NETWORK_TYPE);

function createDeadline() {
  const now = Math.floor(Date.now() / 1000);
  return BigInt((now - EPOCH_ADJUSTMENT + 7200) * 1000);
}

// ランダムなnonce生成
function generateNonce(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF);
}

export async function POST(request: Request) {
  try {
    const { privateKey: privateKeyHex, name, imageUrl } = await request.json();

    if (!privateKeyHex || !name) {
      return NextResponse.json(
        { error: 'Missing privateKey or name' },
        { status: 400 }
      );
    }

    const privateKey = new PrivateKey(privateKeyHex);
    const keyPair = new facade.static.KeyPair(privateKey);
    const signerAddress = facade.network.publicKeyToAddress(keyPair.publicKey);

    const nonce = generateNonce();
    const deadline = createDeadline();

    // MosaicId を計算
    const mosaicId = generateMosaicId(signerAddress, nonce);

    // 1. モザイク定義トランザクション
    const mosaicDefinitionTx = facade.transactionFactory.createEmbedded({
      type: 'mosaic_definition_transaction_v1',
      signerPublicKey: keyPair.publicKey,
      nonce,
      id: mosaicId,
      divisibility: 0,
      duration: 0n, // 無期限
      flags: 'transferable restrictable', // 転送可能
    });

    // 2. モザイク供給量変更トランザクション (supply = 1)
    const mosaicSupplyChangeTx = facade.transactionFactory.createEmbedded({
      type: 'mosaic_supply_change_transaction_v1',
      signerPublicKey: keyPair.publicKey,
      mosaicId,
      delta: 1n,
      action: 'increase',
    });

    // 3. メタデータトランザクション（NFT情報を保存）
    const metadataValue = JSON.stringify({ name, image: imageUrl || '' });
    const metadataBytes = new TextEncoder().encode(metadataValue);

    const mosaicMetadataTx = facade.transactionFactory.createEmbedded({
      type: 'mosaic_metadata_transaction_v1',
      signerPublicKey: keyPair.publicKey,
      targetAddress: signerAddress,
      targetMosaicId: mosaicId,
      scopedMetadataKey: 0x4E4654n, // "NFT" in hex
      valueSizeDelta: metadataBytes.length,
      value: metadataBytes,
    });

    // アグリゲートトランザクション
    const aggregateTx = facade.transactionFactory.create({
      type: 'aggregate_complete_transaction_v2',
      signerPublicKey: keyPair.publicKey,
      deadline,
      transactions: [mosaicDefinitionTx, mosaicSupplyChangeTx, mosaicMetadataTx],
      fee: 2000000n, // 2 XYM (アグリゲートは手数料が高め)
    });

    const signature = facade.signTransaction(keyPair, aggregateTx);
    facade.transactionFactory.static.attachSignature(aggregateTx, signature);

    const hash = facade.hashTransaction(aggregateTx).toString();
    const payload = Buffer.from(aggregateTx.serialize()).toString('hex').toUpperCase();

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

    return NextResponse.json({
      hash,
      mosaicId: mosaicId.toString(16).toUpperCase(),
      name,
      imageUrl,
    });
  } catch (error) {
    console.error('NFT create error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
