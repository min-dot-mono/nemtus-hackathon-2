import { NextResponse } from 'next/server';
import { SymbolFacade, Network } from 'symbol-sdk/symbol';
import { PrivateKey } from 'symbol-sdk';

const NETWORK_TYPE = Network.TESTNET;
const facade = new SymbolFacade(NETWORK_TYPE);

// アカウント生成
export async function POST() {
  try {
    const privateKey = PrivateKey.random();
    const keyPair = new facade.static.KeyPair(privateKey);
    const address = facade.network.publicKeyToAddress(keyPair.publicKey);

    return NextResponse.json({
      privateKey: privateKey.toString(),
      publicKey: keyPair.publicKey.toString(),
      address: address.toString(),
    });
  } catch (error) {
    console.error('Account generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate account' },
      { status: 500 }
    );
  }
}

// アカウント復元
export async function PUT(request: Request) {
  try {
    const { privateKey: privateKeyHex } = await request.json();

    const privateKey = new PrivateKey(privateKeyHex);
    const keyPair = new facade.static.KeyPair(privateKey);
    const address = facade.network.publicKeyToAddress(keyPair.publicKey);

    return NextResponse.json({
      privateKey: privateKey.toString(),
      publicKey: keyPair.publicKey.toString(),
      address: address.toString(),
    });
  } catch (error) {
    console.error('Account restore error:', error);
    return NextResponse.json(
      { error: 'Invalid private key' },
      { status: 400 }
    );
  }
}
