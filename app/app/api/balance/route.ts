import { NextResponse } from 'next/server';

const NODE_URL = 'https://sym-test-01.opening-line.jp:3001';
const CURRENCY_MOSAIC_ID = '72C0212E67A08BCE';

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

    const response = await fetch(`${NODE_URL}/accounts/${address}`);

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ balance: '0' });
      }
      throw new Error(`Failed to fetch account: ${response.statusText}`);
    }

    const data = await response.json();
    const mosaics = data.account?.mosaics || [];
    const xym = mosaics.find(
      (m: { id: string }) => m.id.toUpperCase() === CURRENCY_MOSAIC_ID.toUpperCase()
    );

    return NextResponse.json({
      balance: xym ? xym.amount : '0',
    });
  } catch (error) {
    console.error('Balance error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
