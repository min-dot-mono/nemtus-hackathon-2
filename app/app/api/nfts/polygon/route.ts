import { NextResponse } from 'next/server';

// Alchemy API（Polygon Mainnet）
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
const ALCHEMY_BASE_URL = `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`;

interface AlchemyNft {
  contract: {
    address: string;
    name?: string;
  };
  tokenId: string;
  name?: string;
  image?: {
    cachedUrl?: string;
    originalUrl?: string;
    thumbnailUrl?: string;
  };
  raw?: {
    metadata?: {
      name?: string;
      image?: string;
    };
  };
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

    // Ethereum アドレス形式チェック
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address format' },
        { status: 400 }
      );
    }

    // Alchemy NFT API を使用してNFTを取得
    const response = await fetch(
      `${ALCHEMY_BASE_URL}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=50`,
      {
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      // APIキーがない場合のフォールバック
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({
          nfts: [],
          message: 'Alchemy API key required. Set ALCHEMY_API_KEY in .env.local',
        });
      }
      throw new Error(`Alchemy API error: ${response.status}`);
    }

    const data = await response.json();
    const ownedNfts = data.ownedNfts || [];

    // NFTデータを整形
    const nfts = ownedNfts
      .filter((nft: AlchemyNft) => {
        // 画像があるNFTのみ
        return nft.image?.cachedUrl || nft.image?.originalUrl || nft.raw?.metadata?.image;
      })
      .map((nft: AlchemyNft) => {
        const imageUrl = nft.image?.cachedUrl ||
                        nft.image?.thumbnailUrl ||
                        nft.image?.originalUrl ||
                        nft.raw?.metadata?.image;

        return {
          id: `${nft.contract.address}:${nft.tokenId}`,
          contractAddress: nft.contract.address,
          tokenId: nft.tokenId,
          name: nft.name || nft.raw?.metadata?.name || `#${nft.tokenId}`,
          collectionName: nft.contract.name || 'Unknown Collection',
          imageUrl,
          chain: 'polygon',
        };
      })
      .slice(0, 20); // 最大20件

    return NextResponse.json({ nfts });
  } catch (error) {
    console.error('Polygon NFT fetch error:', error);
    return NextResponse.json(
      { error: String(error), nfts: [] },
      { status: 500 }
    );
  }
}
