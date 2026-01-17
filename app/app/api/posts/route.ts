import { NextResponse } from 'next/server';
import { NODE_URL, UNDO_CHANNEL_ADDRESS } from '../../lib/constants';

export async function GET() {
  try {
    // チャンネルアドレス宛のトランザクションを取得
    const response = await fetch(
      `${NODE_URL}/transactions/confirmed?recipientAddress=${UNDO_CHANNEL_ADDRESS}&type=16724&pageSize=50&order=desc`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch transactions: ${response.statusText}`);
    }

    const data = await response.json();
    const transactions = data.data || [];

    // 投稿データに変換
    const posts = transactions.map((tx: {
      meta: { hash: string; timestamp: string };
      transaction: { signerPublicKey: string; message?: string };
    }) => {
      let message = '';

      // メッセージをデコード
      if (tx.transaction.message) {
        try {
          const messageHex = tx.transaction.message;
          const bytes = new Uint8Array(
            messageHex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
          );
          // 最初のバイトはメッセージタイプ（0=平文）なのでスキップ
          if (bytes[0] === 0) {
            message = new TextDecoder().decode(bytes.slice(1));
          }
        } catch {
          message = '[デコード失敗]';
        }
      }

      // タイムスタンプをエポック調整して変換
      const EPOCH_ADJUSTMENT = 1667250467;
      const timestamp = new Date((parseInt(tx.meta.timestamp) / 1000 + EPOCH_ADJUSTMENT) * 1000);

      return {
        hash: tx.meta.hash,
        signerPublicKey: tx.transaction.signerPublicKey,
        message,
        timestamp: timestamp.toISOString(),
      };
    }).filter((post: { message: string }) => post.message && post.message.length > 0);

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Posts fetch error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
