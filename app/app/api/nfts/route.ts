import { NextResponse } from 'next/server';
import { NODE_URL } from '../../lib/constants';

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

    // アカウント情報を取得
    const accountResponse = await fetch(`${NODE_URL}/accounts/${address}`);

    if (!accountResponse.ok) {
      // アカウントが見つからない、またはエラーの場合は空配列を返す
      return NextResponse.json({ nfts: [] });
    }

    const accountData = await accountResponse.json();
    const mosaics = accountData.account?.mosaics || [];

    // 各モザイクの詳細を取得してNFT（supply=1, divisibility=0）をフィルタ
    const nftPromises = mosaics.map(async (mosaic: { id: string; amount: string }) => {
      try {
        const mosaicResponse = await fetch(`${NODE_URL}/mosaics/${mosaic.id}`);
        if (!mosaicResponse.ok) return null;

        const mosaicData = await mosaicResponse.json();
        const mosaicInfo = mosaicData.mosaic;

        // NFT条件: supply=1, divisibility=0
        if (mosaicInfo.supply === '1' && mosaicInfo.divisibility === 0) {
          // メタデータを取得してみる
          let imageUrl = null;
          let name = null;

          try {
            const metadataResponse = await fetch(
              `${NODE_URL}/metadata?targetId=${mosaic.id}&metadataType=1&pageSize=10`
            );
            if (metadataResponse.ok) {
              const metadataData = await metadataResponse.json();
              const entries = metadataData.data || [];

              for (const entry of entries) {
                try {
                  const valueHex = entry.metadataEntry?.value;
                  if (valueHex) {
                    const bytes = new Uint8Array(
                      valueHex.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) || []
                    );
                    const text = new TextDecoder().decode(bytes);

                    // JSONとしてパースを試みる
                    try {
                      const json = JSON.parse(text);
                      if (json.image) imageUrl = json.image;
                      if (json.name) name = json.name;
                    } catch {
                      // URLっぽければ画像として扱う
                      if (text.startsWith('http') && (text.includes('.png') || text.includes('.jpg') || text.includes('.gif') || text.includes('ipfs'))) {
                        imageUrl = text;
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore metadata errors
          }

          return {
            id: mosaic.id,
            name: name || `NFT #${mosaic.id.slice(0, 8)}`,
            imageUrl,
          };
        }
        return null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(nftPromises);
    const nfts = results.filter((n): n is NonNullable<typeof n> => n !== null);

    return NextResponse.json({ nfts });
  } catch (error) {
    console.error('NFTs fetch error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
