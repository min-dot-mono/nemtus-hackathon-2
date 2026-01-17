import { NextResponse } from 'next/server';
import { NODE_URL, UNDO_CHANNEL_ADDRESS } from '../../lib/constants';

const EPOCH_ADJUSTMENT = 1667250467;

// メッセージをデコード
function decodeMessage(messageHex: string): string {
  try {
    const bytes = new Uint8Array(
      messageHex.match(/.{1,2}/g)?.map((byte: string) => parseInt(byte, 16)) || []
    );
    if (bytes[0] === 0) {
      return new TextDecoder().decode(bytes.slice(1));
    }
  } catch {
    // ignore
  }
  return '';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Missing address' },
        { status: 400 }
      );
    }

    // ユーザーの投稿を取得（チャンネル宛で、このユーザーが送信したもの）
    const postsResponse = await fetch(
      `${NODE_URL}/transactions/confirmed?recipientAddress=${UNDO_CHANNEL_ADDRESS}&type=16724&pageSize=100`
    );

    let posts: Array<{
      hash: string;
      message: string;
      timestamp: string;
      likes: number;
    }> = [];

    if (postsResponse.ok) {
      const postsData = await postsResponse.json();
      const allTransactions = postsData.data || [];

      // このユーザーの投稿をフィルタ（signerAddressで比較するためにまず変換が必要）
      // 簡略化: signerPublicKeyからaddressへの変換はフロントでやっているので、
      // ここではsignerPublicKeyで返して、フロント側でフィルタする
      posts = allTransactions
        .filter((tx: { transaction: { signerPublicKey: string } }) => {
          // アドレスとpublicKeyの対応を確認する必要があるが、
          // 簡略化のため全投稿を返し、フロントでフィルタ
          return true;
        })
        .map((tx: {
          meta: { hash: string; timestamp: string };
          transaction: { signerPublicKey: string; message?: string };
        }) => {
          const message = tx.transaction.message ? decodeMessage(tx.transaction.message) : '';
          const timestamp = new Date((parseInt(tx.meta.timestamp) / 1000 + EPOCH_ADJUSTMENT) * 1000);

          return {
            hash: tx.meta.hash,
            signerPublicKey: tx.transaction.signerPublicKey,
            message,
            timestamp: timestamp.toISOString(),
            likes: 0,
          };
        })
        .filter((post: { message: string }) => post.message && post.message.length > 0);
    }

    // ユーザーが受け取ったいいね（このアドレス宛のLIKE:メッセージ）
    const likesResponse = await fetch(
      `${NODE_URL}/transactions/confirmed?recipientAddress=${address}&type=16724&pageSize=100`
    );

    let receivedLikes: Array<{
      hash: string;
      postHash: string;
      from: string;
      amount: string;
      timestamp: string;
    }> = [];

    let totalReceived = 0n;

    if (likesResponse.ok) {
      const likesData = await likesResponse.json();
      const likeTransactions = likesData.data || [];

      receivedLikes = likeTransactions
        .filter((tx: { transaction: { message?: string } }) => {
          if (!tx.transaction.message) return false;
          const message = decodeMessage(tx.transaction.message);
          return message.startsWith('LIKE:');
        })
        .map((tx: {
          meta: { hash: string; timestamp: string };
          transaction: { signerPublicKey: string; message?: string; mosaics?: Array<{ mosaicId?: string; amount?: string }> };
        }) => {
          const message = tx.transaction.message ? decodeMessage(tx.transaction.message) : '';
          const postHash = message.substring(5);
          const timestamp = new Date((parseInt(tx.meta.timestamp) / 1000 + EPOCH_ADJUSTMENT) * 1000);

          // 受け取ったXYM量を計算
          const mosaics = tx.transaction.mosaics || [];
          const xymMosaic = mosaics.find((m) =>
            m.mosaicId?.toUpperCase() === '72C0212E67A08BCE'
          );
          const amount = xymMosaic ? BigInt(xymMosaic.amount || '0') : 0n;
          totalReceived += amount;

          return {
            hash: tx.meta.hash,
            postHash,
            from: tx.transaction.signerPublicKey.slice(0, 8) + '...',
            amount: (Number(amount) / 1000000).toFixed(2),
            timestamp: timestamp.toISOString(),
          };
        });
    }

    return NextResponse.json({
      address,
      posts,
      receivedLikes,
      totalReceivedXym: (Number(totalReceived) / 1000000).toFixed(2),
      likeCount: receivedLikes.length,
    });
  } catch (error) {
    console.error('User fetch error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
