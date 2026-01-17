import { NextResponse } from 'next/server';
import { SymbolFacade, Network } from 'symbol-sdk/symbol';
import { PublicKey } from 'symbol-sdk';
import { NODE_URL, UNDO_CHANNEL_ADDRESS } from '../../lib/constants';

const facade = new SymbolFacade(Network.TESTNET);
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

// 特定アドレス宛のいいねトランザクションを取得
async function fetchLikesForAddress(address: string): Promise<Map<string, number>> {
  const likeCounts = new Map<string, number>();

  try {
    const response = await fetch(
      `${NODE_URL}/transactions/confirmed?recipientAddress=${address}&type=16724&pageSize=100`
    );

    if (!response.ok) return likeCounts;

    const data = await response.json();
    const transactions = data.data || [];

    for (const tx of transactions) {
      if (tx.transaction.message) {
        const message = decodeMessage(tx.transaction.message);
        if (message.startsWith('LIKE:')) {
          const postHash = message.substring(5);
          likeCounts.set(postHash, (likeCounts.get(postHash) || 0) + 1);
        }
      }
    }
  } catch {
    // ignore
  }

  return likeCounts;
}

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
      const message = tx.transaction.message ? decodeMessage(tx.transaction.message) : '';
      const timestamp = new Date((parseInt(tx.meta.timestamp) / 1000 + EPOCH_ADJUSTMENT) * 1000);
      const signerAddress = facade.network.publicKeyToAddress(
        new PublicKey(tx.transaction.signerPublicKey)
      ).toString();

      return {
        hash: tx.meta.hash,
        signerPublicKey: tx.transaction.signerPublicKey,
        signerAddress,
        message,
        timestamp: timestamp.toISOString(),
        likes: 0,
      };
    }).filter((post: { message: string }) => post.message && post.message.length > 0);

    // ユニークな投稿者アドレスを取得
    const uniqueAddresses = [...new Set(posts.map((p: { signerAddress: string }) => p.signerAddress))];

    // 各アドレスのいいね数を取得
    const allLikeCounts = new Map<string, number>();
    await Promise.all(
      uniqueAddresses.map(async (address) => {
        const likes = await fetchLikesForAddress(address as string);
        likes.forEach((count, hash) => {
          allLikeCounts.set(hash, (allLikeCounts.get(hash) || 0) + count);
        });
      })
    );

    // 投稿にいいね数を追加
    const postsWithLikes = posts.map((post: { hash: string; likes: number }) => ({
      ...post,
      likes: allLikeCounts.get(post.hash) || 0,
    }));

    return NextResponse.json({ posts: postsWithLikes });
  } catch (error) {
    console.error('Posts fetch error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
