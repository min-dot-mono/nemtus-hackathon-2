const KEYS = {
  USER_ACCOUNT: 'undo_user_account',
  POSTS: 'undo_posts',
};

export type NFTIcon = {
  id: string;
  name: string;
  imageUrl?: string;
  chain?: 'symbol' | 'polygon'; // どのチェーンのNFTか
  contractAddress?: string; // ERC-721の場合
  tokenId?: string; // ERC-721の場合
};

export type UserAccount = {
  privateKey: string;
  publicKey: string;
  address: string;
  createdAt: number;
  nftIcon?: NFTIcon;
  evmAddress?: string; // Polygon/Ethereum ウォレットアドレス
};

export type Post = {
  hash: string;
  message: string;
  address: string;
  timestamp: number;
  likes: number;
};

// ユーザーアカウント
export function getUserAccount(): UserAccount | null {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem(KEYS.USER_ACCOUNT);
  return data ? JSON.parse(data) : null;
}

export function saveUserAccount(account: UserAccount): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEYS.USER_ACCOUNT, JSON.stringify(account));
}

export function clearUserAccount(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.USER_ACCOUNT);
}

// ローカル投稿キャッシュ
export function getLocalPosts(): Post[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(KEYS.POSTS);
  return data ? JSON.parse(data) : [];
}

export function addLocalPost(post: Post): void {
  if (typeof window === 'undefined') return;
  const posts = getLocalPosts();
  posts.unshift(post);
  localStorage.setItem(KEYS.POSTS, JSON.stringify(posts));
}

export function clearAllData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.USER_ACCOUNT);
  localStorage.removeItem(KEYS.POSTS);
}
