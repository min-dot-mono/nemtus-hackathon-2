'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getUserAccount,
  saveUserAccount,
  clearAllData,
  type UserAccount,
  type NFTIcon,
} from '@/lib/storage';
import {
  WarningTriangle,
  Check,
  RefreshDouble,
  LightBulb,
  Heart,
  User,
  Xmark,
  MediaImage,
  Plus,
  ArrowLeft,
} from 'iconoir-react';

// グローバル投稿の型
interface GlobalPost {
  hash: string;
  signerPublicKey: string;
  signerAddress: string;
  message: string;
  timestamp: string;
  likes: number;
}

// NFTの型
interface NFT {
  id: string;
  name: string;
  imageUrl?: string;
  chain?: 'symbol' | 'polygon';
  contractAddress?: string;
  tokenId?: string;
  collectionName?: string;
}

// ユーザープロフィールの型
interface UserProfile {
  address: string;
  posts: Array<{
    hash: string;
    signerPublicKey: string;
    message: string;
    timestamp: string;
  }>;
  receivedLikes: Array<{
    hash: string;
    postHash: string;
    from: string;
    amount: string;
    timestamp: string;
  }>;
  totalReceivedXym: string;
  likeCount: number;
}

// スケルトンローダーコンポーネント
function SkeletonPost() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative overflow-hidden">
      <div className="space-y-3">
        <div className="h-4 bg-zinc-800 rounded w-3/4 skeleton-shimmer" />
        <div className="h-4 bg-zinc-800 rounded w-full skeleton-shimmer" />
        <div className="h-4 bg-zinc-800 rounded w-1/2 skeleton-shimmer" />
      </div>
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
        <div className="h-3 bg-zinc-800 rounded w-32 skeleton-shimmer" />
        <div className="h-3 bg-zinc-800 rounded w-16 skeleton-shimmer" />
      </div>
    </div>
  );
}

// トーストの型
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
  hash?: string;
  exiting?: boolean;
}

// デモ用プリセット文章
const PRESET_MESSAGES = [
  { label: '哲学的', text: '自由とは、責任を引き受けることだ。' },
  { label: '宣言', text: '私はこの発言に責任を持つ。' },
  { label: 'ユーモア', text: 'このSNS、怖すぎる。でも使う。' },
  { label: 'ハッカソン', text: 'NEMTUS Hackathon 2026、最高！' },
];

export default function Home() {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [posts, setPosts] = useState<GlobalPost[]>([]);
  const [newPost, setNewPost] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [balance, setBalance] = useState<bigint>(0n);
  const [showSetup, setShowSetup] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showPresets, setShowPresets] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [showPresenterGuide, setShowPresenterGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [likingPost, setLikingPost] = useState<string | null>(null);
  const [showLikeConfirm, setShowLikeConfirm] = useState(false);
  const [likeTarget, setLikeTarget] = useState<GlobalPost | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [showNftModal, setShowNftModal] = useState(false);
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [nftCreateMode, setNftCreateMode] = useState(false);
  const [newNftName, setNewNftName] = useState('');
  const [newNftImageUrl, setNewNftImageUrl] = useState('');
  const [isCreatingNft, setIsCreatingNft] = useState(false);
  const [nftChain, setNftChain] = useState<'symbol' | 'polygon'>('polygon');
  const [evmAddressInput, setEvmAddressInput] = useState('');
  const [polygonNfts, setPolygonNfts] = useState<NFT[]>([]);
  const [isLoadingPolygonNfts, setIsLoadingPolygonNfts] = useState(false);

  // トースト表示
  const showToast = useCallback((type: Toast['type'], message: string, hash?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, hash }]);

    // 4秒後に退出アニメーション開始
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
      // アニメーション完了後に削除
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 4000);
  }, []);

  // プレゼンターガイドのステップ
  const presenterSteps = [
    { title: 'アカウント作成', desc: '「新規アカウント作成」をクリック' },
    { title: '投稿を書く', desc: 'プリセットボタンで文章を入力' },
    { title: '投稿確認', desc: '「投稿する」をクリック → 確認モーダル' },
    { title: '投稿実行', desc: '「覚悟を決めて投稿」をクリック' },
    { title: '削除不可を確認', desc: '削除ボタンがないことを示す' },
    { title: 'Explorer確認', desc: 'TXリンクでブロックチェーン記録を確認' },
  ];

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey) {
        if (e.key === 'D' || e.key === 'd') {
          e.preventDefault();
          setDemoMode((prev) => !prev);
        } else if (e.key === 'P' || e.key === 'p') {
          e.preventDefault();
          setShowPresets((prev) => !prev);
        } else if (e.key === 'R' || e.key === 'r') {
          e.preventDefault();
          handleClearData();
        } else if (e.key === 'G' || e.key === 'g') {
          e.preventDefault();
          setShowPresenterGuide((prev) => !prev);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 残高取得
  const fetchBalance = useCallback(async (address: string) => {
    if (demoMode) {
      setBalance(1000000000n); // デモモードでは1000 XYM
      return;
    }
    setIsLoadingBalance(true);
    try {
      const res = await fetch(`/api/balance?address=${address}`);
      const data = await res.json();
      setBalance(BigInt(data.balance || '0'));
    } catch (e) {
      console.error('Failed to fetch balance:', e);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [demoMode]);

  // グローバル投稿一覧を取得
  const fetchPosts = useCallback(async () => {
    if (demoMode) return;
    setIsLoadingPosts(true);
    try {
      const res = await fetch('/api/posts');
      const data = await res.json();
      if (data.posts) {
        setPosts(data.posts);
      }
    } catch (e) {
      console.error('Failed to fetch posts:', e);
    } finally {
      setIsLoadingPosts(false);
    }
  }, [demoMode]);

  // 初期化
  useEffect(() => {
    const saved = getUserAccount();
    if (saved) {
      setAccount(saved);
    } else {
      setShowSetup(true);
    }
    setIsLoading(false);
  }, []);

  // アカウント変更時に残高・投稿一覧を取得
  useEffect(() => {
    if (account) {
      fetchBalance(account.address);
      fetchPosts();
    }
  }, [account, fetchBalance, fetchPosts]);

  // 新規アカウント作成
  const handleCreateAccount = async () => {
    try {
      if (demoMode) {
        const acc = {
          privateKey: 'DEMO_' + Math.random().toString(36).substring(2, 15).toUpperCase(),
          publicKey: 'DEMO_' + Math.random().toString(36).substring(2, 15).toUpperCase(),
          address: 'TDEMOADRESS' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        };
        const userAccount: UserAccount = { ...acc, createdAt: Date.now() };
        saveUserAccount(userAccount);
        setAccount(userAccount);
        setShowSetup(false);
        if (showPresenterGuide) setCurrentStep(1);
        return;
      }

      const res = await fetch('/api/account', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create account');
      const acc = await res.json();
      const userAccount: UserAccount = { ...acc, createdAt: Date.now() };
      saveUserAccount(userAccount);
      setAccount(userAccount);
      setShowSetup(false);
      if (showPresenterGuide) setCurrentStep(1);
    } catch (e) {
      setError(`アカウント作成に失敗: ${e}`);
    }
  };

  // アカウント復元
  const handleRestoreAccount = async () => {
    try {
      const res = await fetch('/api/account', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ privateKey: privateKeyInput.trim() }),
      });
      if (!res.ok) throw new Error('Invalid private key');
      const acc = await res.json();
      const userAccount: UserAccount = { ...acc, createdAt: Date.now() };
      saveUserAccount(userAccount);
      setAccount(userAccount);
      setShowSetup(false);
      setPrivateKeyInput('');
      setError('');
    } catch {
      setError('無効な秘密鍵です');
    }
  };

  // プリセット文章を選択
  const handleSelectPreset = (text: string) => {
    setNewPost(text);
    setShowPresets(false);
    if (showPresenterGuide) setCurrentStep(2);
  };

  // 投稿確認
  const handlePostClick = () => {
    if (!newPost.trim()) return;
    setShowConfirm(true);
    if (showPresenterGuide) setCurrentStep(3);
  };

  // 投稿実行
  const handleConfirmPost = async () => {
    if (!account || !newPost.trim()) return;
    setIsPosting(true);
    setError('');

    try {
      let hash: string;

      if (demoMode) {
        hash = 'DEMO_' + Math.random().toString(36).substring(2, 15).toUpperCase();
        await new Promise((resolve) => setTimeout(resolve, 1500));
      } else {
        const res = await fetch('/api/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            privateKey: account.privateKey,
            message: newPost,
          }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Failed to post');
        }
        const data = await res.json();
        hash = data.hash;
      }

      setNewPost('');
      setShowConfirm(false);
      if (showPresenterGuide) setCurrentStep(4);

      // トースト表示
      showToast('success', 'ブロックチェーンに記録されました', hash);

      // 残高・投稿一覧を更新
      if (!demoMode) {
        setTimeout(() => {
          fetchBalance(account.address);
          fetchPosts();
        }, 3000);
      }
    } catch (e) {
      showToast('error', `投稿に失敗しました: ${e}`);
    } finally {
      setIsPosting(false);
    }
  };

  // データクリア
  const handleClearData = () => {
    clearAllData();
    setAccount(null);
    setPosts([]);
    setShowSetup(true);
    setCurrentStep(0);
  };

  // いいねクリック
  const handleLikeClick = (post: GlobalPost) => {
    if (!account) return;
    // 自分の投稿にはいいねできない
    if (account.publicKey === post.signerPublicKey) return;
    setLikeTarget(post);
    setShowLikeConfirm(true);
  };

  // いいね実行
  const handleConfirmLike = async () => {
    if (!account || !likeTarget) return;
    setLikingPost(likeTarget.hash);
    setShowLikeConfirm(false);

    try {
      const res = await fetch('/api/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: account.privateKey,
          recipientAddress: likeTarget.signerAddress,
          postHash: likeTarget.hash,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to like');
      }

      const data = await res.json();
      showToast('success', '0.1 XYM を送りました', data.hash);

      // 残高更新
      setTimeout(() => fetchBalance(account.address), 3000);
    } catch (e) {
      showToast('error', `いいねに失敗しました: ${e}`);
    } finally {
      setLikingPost(null);
      setLikeTarget(null);
    }
  };

  // ユーザープロフィール表示
  const handleShowProfile = async (address: string, publicKey: string) => {
    setIsLoadingProfile(true);
    setShowProfile(true);

    try {
      const res = await fetch(`/api/user?address=${address}`);
      if (!res.ok) throw new Error('Failed to fetch profile');
      const data = await res.json();

      // 投稿をこのユーザーのものだけにフィルタ
      const userPosts = data.posts.filter(
        (p: { signerPublicKey: string }) => p.signerPublicKey === publicKey
      );

      setProfileData({
        ...data,
        posts: userPosts,
      });
    } catch (e) {
      console.error('Profile fetch error:', e);
      setShowProfile(false);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  // NFT一覧を取得
  const fetchNfts = async () => {
    if (!account) return;
    setIsLoadingNfts(true);
    setShowNftModal(true);
    setNfts([]); // リセット

    try {
      const res = await fetch(`/api/nfts?address=${account.address}`);
      const data = await res.json();
      if (data.nfts) {
        setNfts(data.nfts);
      }
    } catch (e) {
      console.error('NFT fetch error:', e);
      // エラーでも空配列で続行
    } finally {
      setIsLoadingNfts(false);
    }
  };

  // NFTを選択してアイコンに設定
  const handleSelectNft = (nft: NFT) => {
    if (!account) return;
    const updatedAccount: UserAccount = {
      ...account,
      nftIcon: {
        id: nft.id,
        name: nft.name,
        imageUrl: nft.imageUrl,
      },
    };
    saveUserAccount(updatedAccount);
    setAccount(updatedAccount);
    setShowNftModal(false);
  };

  // NFTアイコンをクリア
  const handleClearNftIcon = () => {
    if (!account) return;
    const { nftIcon, ...rest } = account;
    const updatedAccount: UserAccount = rest as UserAccount;
    saveUserAccount(updatedAccount);
    setAccount(updatedAccount);
    setShowNftModal(false);
  };

  // Polygon NFT一覧を取得
  const fetchPolygonNfts = async (evmAddress: string) => {
    if (!evmAddress) return;
    setIsLoadingPolygonNfts(true);
    setPolygonNfts([]);

    try {
      const res = await fetch(`/api/nfts/polygon?address=${evmAddress}`);
      const data = await res.json();
      if (data.nfts) {
        setPolygonNfts(data.nfts.map((nft: NFT) => ({ ...nft, chain: 'polygon' as const })));
      }
      if (data.message) {
        showToast('info', data.message);
      }
    } catch (e) {
      console.error('Polygon NFT fetch error:', e);
      showToast('error', 'Polygon NFTの取得に失敗しました');
    } finally {
      setIsLoadingPolygonNfts(false);
    }
  };

  // EVMアドレスを保存してNFT取得
  const handleFetchPolygonNfts = () => {
    if (!account || !evmAddressInput.trim()) return;

    // アドレス形式チェック
    if (!/^0x[a-fA-F0-9]{40}$/.test(evmAddressInput.trim())) {
      showToast('error', '無効なウォレットアドレスです');
      return;
    }

    // EVMアドレスを保存
    const updatedAccount = { ...account, evmAddress: evmAddressInput.trim() };
    saveUserAccount(updatedAccount);
    setAccount(updatedAccount);

    fetchPolygonNfts(evmAddressInput.trim());
  };

  // Polygon NFTを選択
  const handleSelectPolygonNft = (nft: NFT) => {
    if (!account) return;
    const updatedAccount: UserAccount = {
      ...account,
      nftIcon: {
        id: nft.id,
        name: nft.name,
        imageUrl: nft.imageUrl,
        chain: 'polygon',
        contractAddress: nft.contractAddress,
        tokenId: nft.tokenId,
      },
    };
    saveUserAccount(updatedAccount);
    setAccount(updatedAccount);
    setShowNftModal(false);
    showToast('success', `${nft.name} をアイコンに設定しました`);
  };

  // NFTを作成
  const handleCreateNft = async () => {
    if (!account || !newNftName.trim()) return;
    setIsCreatingNft(true);

    try {
      const res = await fetch('/api/nft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: account.privateKey,
          name: newNftName.trim(),
          imageUrl: newNftImageUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create NFT');
      }

      const data = await res.json();
      showToast('success', `NFT "${newNftName}" を作成しました`, data.hash);

      // フォームをリセット
      setNewNftName('');
      setNewNftImageUrl('');
      setNftCreateMode(false);

      // 残高更新
      setTimeout(() => fetchBalance(account.address), 3000);

      // NFT一覧を再取得（少し待ってから）
      setTimeout(() => {
        fetchNfts();
      }, 5000);
    } catch (e) {
      showToast('error', `NFT作成に失敗: ${e}`);
    } finally {
      setIsCreatingNft(false);
    }
  };

  // ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-red-600 mb-4">UNDO</h1>
          <RefreshDouble className="w-6 h-6 text-zinc-500 mx-auto animate-spin" />
        </div>
      </div>
    );
  }

  // セットアップ画面
  if (showSetup) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 relative">
        {showPresenterGuide && (
          <div className="fixed top-4 right-4 bg-blue-900/90 border border-blue-500 rounded-lg p-4 max-w-xs z-50">
            <p className="text-blue-300 text-xs mb-2">ステップ 1/6</p>
            <p className="text-white font-bold">{presenterSteps[0].title}</p>
            <p className="text-blue-200 text-sm">{presenterSteps[0].desc}</p>
          </div>
        )}

        {demoMode && (
          <div className="fixed top-4 left-4 bg-yellow-900/90 border border-yellow-500 rounded-lg px-3 py-1 z-50">
            <p className="text-yellow-300 text-xs font-bold">DEMO MODE</p>
          </div>
        )}

        <h1 className="text-6xl font-bold mb-4 text-red-600">UNDO</h1>
        <p className="text-zinc-300 mb-2 text-center text-xl">投稿を消せないSNS</p>
        <p className="text-zinc-500 text-lg mb-8 text-center italic max-w-md">
          自由とは、取り消せない選択を引き受けること。
        </p>

        <div className="w-full max-w-md space-y-4">
          <button
            onClick={handleCreateAccount}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-lg font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-red-900/50"
          >
            新規アカウント作成
          </button>

          <div className="text-center text-zinc-500">または</div>

          <div className="space-y-2">
            <input
              type="password"
              value={privateKeyInput}
              onChange={(e) => setPrivateKeyInput(e.target.value)}
              placeholder="秘密鍵を入力して復元"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500"
            />
            <button
              onClick={handleRestoreAccount}
              disabled={!privateKeyInput.trim()}
              className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-white py-3 px-6 rounded-lg transition-colors"
            >
              アカウント復元
            </button>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>

        <div className="absolute bottom-4 left-4 text-zinc-600 text-xs">
          <p>Ctrl+Shift+D: デモモード | Ctrl+Shift+G: ガイド表示</p>
        </div>
      </div>
    );
  }

  // メイン画面
  return (
    <div className="min-h-screen bg-black text-white relative">
      {showPresenterGuide && (
        <div className="fixed top-4 right-4 bg-blue-900/90 border border-blue-500 rounded-lg p-4 max-w-xs z-50">
          <p className="text-blue-300 text-xs mb-2">ステップ {currentStep + 1}/6</p>
          <p className="text-white font-bold">{presenterSteps[currentStep]?.title}</p>
          <p className="text-blue-200 text-sm">{presenterSteps[currentStep]?.desc}</p>
          <div className="flex gap-2 mt-3">
            <button onClick={() => setCurrentStep(Math.max(0, currentStep - 1))} className="text-xs bg-blue-800 px-2 py-1 rounded" disabled={currentStep === 0}>←</button>
            <button onClick={() => setCurrentStep(Math.min(5, currentStep + 1))} className="text-xs bg-blue-800 px-2 py-1 rounded" disabled={currentStep === 5}>→</button>
          </div>
        </div>
      )}

      {demoMode && (
        <div className="fixed top-4 left-4 bg-yellow-900/90 border border-yellow-500 rounded-lg px-3 py-1 z-50">
          <p className="text-yellow-300 text-xs font-bold">DEMO MODE</p>
        </div>
      )}

      {/* トースト通知 */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg border flex items-center gap-3 min-w-[300px] ${
              toast.exiting ? 'toast-exit' : 'toast-enter'
            } ${
              toast.type === 'success'
                ? 'bg-green-900/95 border-green-700 text-green-100'
                : toast.type === 'error'
                ? 'bg-red-900/95 border-red-700 text-red-100'
                : 'bg-zinc-800/95 border-zinc-700 text-zinc-100'
            }`}
          >
            {toast.type === 'success' ? (
              <Check className="w-5 h-5 flex-shrink-0" />
            ) : toast.type === 'error' ? (
              <WarningTriangle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <LightBulb className="w-5 h-5 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.hash && (
                <a
                  href={`https://testnet.symbol.fyi/transactions/${toast.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs opacity-75 hover:opacity-100 underline truncate block"
                >
                  TX: {toast.hash.slice(0, 12)}...
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <header className="border-b border-zinc-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold text-red-600">UNDO</h1>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span className="flex items-center gap-1">
              {isLoadingBalance ? (
                <RefreshDouble className="w-3 h-3 animate-spin" />
              ) : (
                <>{(Number(balance) / 1000000).toFixed(2)} XYM</>
              )}
            </span>
            <button
              onClick={() => {
                if (confirm('すべてのデータを削除しますか？')) handleClearData();
              }}
              className="text-zinc-500 hover:text-red-500 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="mb-6 p-3 bg-red-950/50 border border-red-900 rounded-lg">
          <div className="flex items-center justify-center gap-2 text-sm">
            <LightBulb className="w-4 h-4 text-red-400" />
            <p className="text-center text-zinc-300">
              すべての投稿はブロックチェーンに記録され、
              <span className="text-red-400 font-bold">誰にも削除・編集できません</span>
            </p>
          </div>
        </div>

        {account && (
          <div className="mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <button
                  onClick={fetchNfts}
                  className="flex-shrink-0 w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-700 hover:border-zinc-600 transition-colors overflow-hidden flex items-center justify-center"
                  title="NFTアイコンを設定"
                >
                  {account.nftIcon?.imageUrl ? (
                    <img
                      src={account.nftIcon.imageUrl}
                      alt={account.nftIcon.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MediaImage className="w-5 h-5 text-zinc-500" />
                  )}
                </button>
                <div className="flex-1">
                  <p className="text-xs text-zinc-500 mb-1">あなたのアドレス（Symbol Testnet）</p>
                  <p className="text-sm font-mono text-zinc-300 break-all">{account.address}</p>
                  {account.nftIcon && (
                    <p className="text-xs text-zinc-500 mt-1">NFTアイコン: {account.nftIcon.name}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleClearData}
                className="text-xs text-zinc-500 hover:text-zinc-300 bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
              >
                切替
              </button>
            </div>

            <div className="mt-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPrivateKey ? '秘密鍵を隠す' : '秘密鍵を表示'}
              </button>
              {showPrivateKey && (
                <div className="mt-2 p-2 bg-zinc-800 rounded">
                  <p className="text-xs font-mono text-zinc-400 break-all select-all">{account.privateKey}</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(account.privateKey);
                      alert('コピーしました');
                    }}
                    className="text-xs text-red-500 hover:text-red-400 mt-2"
                  >
                    コピー
                  </button>
                </div>
              )}
            </div>

            {demoMode ? (
              <p className="text-xs text-zinc-600 mt-2">デモモード - 実際のブロックチェーンには記録されません</p>
            ) : (
              <>
                <a
                  href={`https://testnet.symbol.fyi/accounts/${account.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-red-500 hover:underline inline-flex items-center gap-1 mt-2"
                >
                  Explorer で見る
                </a>
                {balance === 0n && (
                  <p className="text-xs text-yellow-500 mt-2 flex items-center gap-1">
                    <WarningTriangle className="w-3 h-3" />
                    残高がありません。
                    <a href="https://testnet.symbol.tools/" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                      Faucetで取得
                    </a>
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="mb-8">
          <div className="relative">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="覚悟を持って投稿する..."
              maxLength={1024}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 resize-none focus:border-red-600 focus:outline-none text-lg"
            />
            <button
              onClick={() => setShowPresets(!showPresets)}
              className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-300 text-xs bg-zinc-800 px-2 py-1 rounded"
            >
              プリセット
            </button>
          </div>

          {showPresets && (
            <div className="mt-2 bg-zinc-900 border border-zinc-700 rounded-lg p-3">
              <p className="text-xs text-zinc-500 mb-2">クリックして挿入:</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_MESSAGES.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectPreset(preset.text)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm px-3 py-2 rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-zinc-500">{newPost.length} / 1024</span>
            <button
              onClick={handlePostClick}
              disabled={!newPost.trim() || (!demoMode && balance === 0n)}
              className="bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-3 px-8 rounded-lg font-bold transition-all transform hover:scale-105 disabled:hover:scale-100"
            >
              投稿する
            </button>
          </div>
        </div>

        {showConfirm && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full border-2 border-red-600 shadow-2xl shadow-red-900/30">
              <div className="text-center mb-4">
                <WarningTriangle className="w-12 h-12 text-red-500 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold text-red-600 mb-4 text-center">本当に投稿しますか？</h2>
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 mb-4">
                <p className="text-red-300 text-sm text-center">
                  この投稿は<span className="font-bold text-red-400">削除できません</span>。<br />
                  <span className="font-bold">ブロックチェーンに永久に記録されます。</span>
                </p>
              </div>
              <div className="bg-black p-4 rounded-lg mb-6 border border-zinc-700">
                <p className="text-white whitespace-pre-wrap text-lg">{newPost}</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg transition-colors">キャンセル</button>
                <button
                  onClick={handleConfirmPost}
                  disabled={isPosting}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white py-3 px-4 rounded-lg font-bold transition-all"
                >
                  {isPosting ? <span className="flex items-center justify-center gap-2"><RefreshDouble className="w-4 h-4 animate-spin" />記録中...</span> : '覚悟を決めて投稿'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showLikeConfirm && likeTarget && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl p-6 max-w-md w-full border-2 border-pink-600 shadow-2xl shadow-pink-900/30">
              <div className="text-center mb-4">
                <Heart className="w-12 h-12 text-pink-500 mx-auto" />
              </div>
              <h2 className="text-2xl font-bold text-pink-500 mb-4 text-center">応援しますか？</h2>
              <div className="bg-pink-900/30 border border-pink-800 rounded-lg p-4 mb-4">
                <p className="text-pink-300 text-sm text-center">
                  <span className="font-bold text-pink-400">0.1 XYM</span> を投稿者に送金します
                </p>
              </div>
              <div className="bg-black p-4 rounded-lg mb-6 border border-zinc-700">
                <p className="text-white whitespace-pre-wrap text-sm">{likeTarget.message}</p>
                <p className="text-zinc-500 text-xs mt-2">by {likeTarget.signerAddress.slice(0, 8)}...</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowLikeConfirm(false);
                    setLikeTarget(null);
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 px-4 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleConfirmLike}
                  className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-3 px-4 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Heart className="w-4 h-4" />
                  応援する
                </button>
              </div>
            </div>
          </div>
        )}

        {showProfile && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-zinc-700">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5" />
                  ユーザープロフィール
                </h2>
                <button
                  onClick={() => {
                    setShowProfile(false);
                    setProfileData(null);
                  }}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <Xmark className="w-6 h-6" />
                </button>
              </div>

              {isLoadingProfile ? (
                <div className="p-8 text-center">
                  <RefreshDouble className="w-8 h-8 text-zinc-500 mx-auto animate-spin" />
                </div>
              ) : profileData && (
                <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
                  <div className="p-4 border-b border-zinc-800">
                    <p className="text-xs text-zinc-500 mb-1">アドレス</p>
                    <p className="text-sm font-mono text-zinc-300 break-all">{profileData.address}</p>

                    <div className="flex gap-4 mt-4">
                      <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-white">{profileData.posts.length}</p>
                        <p className="text-xs text-zinc-500">投稿</p>
                      </div>
                      <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-pink-500">{profileData.likeCount}</p>
                        <p className="text-xs text-zinc-500">いいね</p>
                      </div>
                      <div className="flex-1 bg-zinc-800 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-500">{profileData.totalReceivedXym}</p>
                        <p className="text-xs text-zinc-500">獲得 XYM</p>
                      </div>
                    </div>
                  </div>

                  {profileData.posts.length > 0 && (
                    <div className="p-4 border-b border-zinc-800">
                      <h3 className="text-sm font-bold text-zinc-400 mb-3">投稿一覧</h3>
                      <div className="space-y-3">
                        {profileData.posts.map((post) => (
                          <div key={post.hash} className="bg-zinc-800 rounded-lg p-3">
                            <p className="text-white text-sm whitespace-pre-wrap">{post.message}</p>
                            <p className="text-xs text-zinc-500 mt-2">
                              {new Date(post.timestamp).toLocaleString('ja-JP')}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {profileData.receivedLikes.length > 0 && (
                    <div className="p-4">
                      <h3 className="text-sm font-bold text-zinc-400 mb-3">受け取ったいいね</h3>
                      <div className="space-y-2">
                        {profileData.receivedLikes.map((like) => (
                          <div key={like.hash} className="flex items-center justify-between bg-zinc-800 rounded-lg p-3">
                            <div className="flex items-center gap-2">
                              <Heart className="w-4 h-4 text-pink-500" />
                              <span className="text-zinc-400 text-sm">{like.from}</span>
                            </div>
                            <span className="text-pink-500 text-sm font-bold">+{like.amount} XYM</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showNftModal && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-zinc-700">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MediaImage className="w-5 h-5" />
                  NFTアイコンを選択
                </h2>
                <button
                  onClick={() => {
                    setShowNftModal(false);
                    setNftCreateMode(false);
                    setNewNftName('');
                    setNewNftImageUrl('');
                  }}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <Xmark className="w-6 h-6" />
                </button>
              </div>

              {/* チェーン選択タブ */}
              <div className="flex border-b border-zinc-800">
                <button
                  onClick={() => setNftChain('polygon')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    nftChain === 'polygon'
                      ? 'text-purple-400 border-b-2 border-purple-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Polygon (ERC-721)
                </button>
                <button
                  onClick={() => setNftChain('symbol')}
                  className={`flex-1 py-3 text-sm font-medium transition-colors ${
                    nftChain === 'symbol'
                      ? 'text-red-400 border-b-2 border-red-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Symbol
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(80vh-180px)] p-4">
                {nftChain === 'polygon' ? (
                  /* Polygon NFT */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-2">Polygonウォレットアドレス</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={evmAddressInput}
                          onChange={(e) => setEvmAddressInput(e.target.value)}
                          placeholder="0x..."
                          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none font-mono text-sm"
                        />
                        <button
                          onClick={handleFetchPolygonNfts}
                          disabled={!evmAddressInput.trim() || isLoadingPolygonNfts}
                          className="bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                        >
                          {isLoadingPolygonNfts ? (
                            <RefreshDouble className="w-4 h-4 animate-spin" />
                          ) : (
                            '取得'
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1">MetaMaskなどのウォレットアドレスを入力</p>
                    </div>

                    {isLoadingPolygonNfts ? (
                      <div className="text-center py-8">
                        <RefreshDouble className="w-8 h-8 text-purple-500 mx-auto animate-spin" />
                        <p className="text-zinc-500 mt-2">Polygon NFTを読み込み中...</p>
                      </div>
                    ) : polygonNfts.length > 0 ? (
                      <div className="grid grid-cols-3 gap-3">
                        {polygonNfts.map((nft) => (
                          <button
                            key={nft.id}
                            onClick={() => handleSelectPolygonNft(nft)}
                            className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-3 transition-colors text-left border border-zinc-700 hover:border-purple-500"
                          >
                            <div className="aspect-square bg-zinc-700 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                              {nft.imageUrl ? (
                                <img
                                  src={nft.imageUrl}
                                  alt={nft.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <MediaImage className="w-8 h-8 text-zinc-500" />
                              )}
                            </div>
                            <p className="text-xs text-zinc-300 truncate">{nft.name}</p>
                            <p className="text-xs text-purple-400 truncate">{nft.collectionName}</p>
                          </button>
                        ))}
                      </div>
                    ) : account?.evmAddress ? (
                      <div className="text-center py-8">
                        <MediaImage className="w-12 h-12 text-zinc-600 mx-auto" />
                        <p className="text-zinc-500 mt-2">NFTが見つかりません</p>
                        <p className="text-zinc-600 text-sm mt-1">このアドレスにはNFTがないようです</p>
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-zinc-800/50 rounded-lg">
                        <p className="text-purple-400 font-medium">ERC-721 NFT</p>
                        <p className="text-zinc-500 text-sm mt-2">
                          ウォレットアドレスを入力してNFTを取得
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Symbol NFT */
                  <>
                    {nftCreateMode ? (
                      <div className="space-y-4">
                        <button
                          onClick={() => setNftCreateMode(false)}
                          className="text-zinc-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          戻る
                        </button>

                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">NFT名 *</label>
                          <input
                            type="text"
                            value={newNftName}
                            onChange={(e) => setNewNftName(e.target.value)}
                            placeholder="My NFT Icon"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                            maxLength={50}
                          />
                        </div>

                        <div>
                          <label className="block text-sm text-zinc-400 mb-2">画像URL（任意）</label>
                          <input
                            type="url"
                            value={newNftImageUrl}
                            onChange={(e) => setNewNftImageUrl(e.target.value)}
                            placeholder="https://example.com/image.png"
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 focus:border-red-600 focus:outline-none"
                          />
                        </div>

                        {newNftImageUrl && (
                          <div className="w-24 h-24 bg-zinc-800 rounded-lg overflow-hidden border border-zinc-700">
                            <img
                              src={newNftImageUrl}
                              alt="Preview"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        <div className="bg-zinc-800 rounded-lg p-3">
                          <p className="text-xs text-zinc-400">
                            作成には約 <span className="text-red-400 font-bold">2 XYM</span> の手数料
                          </p>
                        </div>

                        <button
                          onClick={handleCreateNft}
                          disabled={!newNftName.trim() || isCreatingNft}
                          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-zinc-800 disabled:text-zinc-600 text-white py-3 px-4 rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
                        >
                          {isCreatingNft ? (
                            <>
                              <RefreshDouble className="w-4 h-4 animate-spin" />
                              作成中...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              作成
                            </>
                          )}
                        </button>
                      </div>
                    ) : isLoadingNfts ? (
                      <div className="text-center py-8">
                        <RefreshDouble className="w-8 h-8 text-red-500 mx-auto animate-spin" />
                        <p className="text-zinc-500 mt-2">Symbol NFTを読み込み中...</p>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setNftCreateMode(true)}
                          className="w-full mb-4 bg-zinc-800 hover:bg-zinc-700 border-2 border-dashed border-zinc-600 hover:border-zinc-500 rounded-lg p-4 transition-colors flex items-center justify-center gap-2 text-zinc-400 hover:text-white"
                        >
                          <Plus className="w-5 h-5" />
                          Symbolで新規作成
                        </button>

                        {nfts.length === 0 ? (
                          <div className="text-center py-8">
                            <MediaImage className="w-12 h-12 text-zinc-600 mx-auto" />
                            <p className="text-zinc-500 mt-2">Symbol NFTが見つかりません</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-3">
                            {nfts.map((nft) => (
                              <button
                                key={nft.id}
                                onClick={() => handleSelectNft(nft)}
                                className="bg-zinc-800 hover:bg-zinc-700 rounded-lg p-3 transition-colors text-left"
                              >
                                <div className="aspect-square bg-zinc-700 rounded-lg mb-2 overflow-hidden flex items-center justify-center">
                                  {nft.imageUrl ? (
                                    <img
                                      src={nft.imageUrl}
                                      alt={nft.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <MediaImage className="w-8 h-8 text-zinc-500" />
                                  )}
                                </div>
                                <p className="text-xs text-zinc-300 truncate">{nft.name}</p>
                                <p className="text-xs text-zinc-600 truncate">{nft.id.slice(0, 8)}...</p>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>

              {account?.nftIcon && (
                <div className="p-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">
                      現在: {account.nftIcon.name}
                      {account.nftIcon.chain === 'polygon' && (
                        <span className="ml-1 text-purple-400">(Polygon)</span>
                      )}
                    </span>
                    <button
                      onClick={handleClearNftIcon}
                      className="text-sm text-red-500 hover:text-red-400 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-900/30 border border-red-800 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError('')} className="text-red-500 text-xs mt-2 hover:underline">閉じる</button>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-300">グローバルフィード</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => fetchPosts()}
                disabled={isLoadingPosts}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                <RefreshDouble className={`w-3 h-3 ${isLoadingPosts ? 'animate-spin' : ''}`} />
                {isLoadingPosts ? '読み込み中' : '更新'}
              </button>
              <p className="text-xs text-zinc-600">削除ボタンはありません</p>
            </div>
          </div>

          {isLoadingPosts && posts.length === 0 ? (
            <div className="space-y-4">
              <SkeletonPost />
              <SkeletonPost />
              <SkeletonPost />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <p className="text-zinc-500 text-lg">まだ投稿がありません</p>
              <p className="text-zinc-600 text-sm mt-2">最初の一歩を踏み出しましょう</p>
            </div>
          ) : (
            posts.map((post) => {
              const isMyPost = account?.publicKey === post.signerPublicKey;
              return (
                <div key={post.hash} className={`bg-zinc-900 border rounded-lg p-4 relative ${isMyPost ? 'border-red-800' : 'border-zinc-800'}`}>
                  <div className="absolute -top-2 -right-2 bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-700">削除不可</div>
                  {isMyPost && (
                    <div className="absolute -top-2 -left-2 bg-blue-900 text-blue-300 text-xs px-2 py-0.5 rounded-full border border-blue-700">自分</div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleShowProfile(post.signerAddress, post.signerPublicKey)}
                      className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center hover:border-zinc-600 transition-colors"
                      title={post.signerAddress}
                    >
                      {isMyPost && account?.nftIcon?.imageUrl ? (
                        <img
                          src={account.nftIcon.imageUrl}
                          alt={account.nftIcon.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-zinc-500" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-white whitespace-pre-wrap mb-4 text-lg leading-relaxed">{post.message}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800">
                    <div className="flex items-center gap-2">
                      <span>{new Date(post.timestamp).toLocaleString('ja-JP')}</span>
                      <span className="text-zinc-700">|</span>
                      <button
                        onClick={() => handleShowProfile(post.signerAddress, post.signerPublicKey)}
                        className="font-mono text-zinc-600 hover:text-zinc-300 transition-colors flex items-center gap-1"
                        title={post.signerAddress}
                      >
                        {post.signerAddress.slice(0, 6)}...
                      </button>
                    </div>
                    <div className="flex items-center gap-4">
                      {post.likes > 0 && (
                        <span className="flex items-center gap-1 text-pink-500">
                          <Heart className="w-4 h-4 fill-pink-500" />
                          <span>{post.likes}</span>
                        </span>
                      )}
                      {!isMyPost && (
                        <button
                          onClick={() => handleLikeClick(post)}
                          disabled={likingPost === post.hash || balance < 100000n}
                          className="flex items-center gap-1 text-zinc-400 hover:text-pink-500 disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors"
                          title="0.1 XYM を送って応援"
                        >
                          {likingPost === post.hash ? (
                            <RefreshDouble className="w-4 h-4 animate-spin" />
                          ) : (
                            <Heart className="w-4 h-4" />
                          )}
                          <span>0.1</span>
                        </button>
                      )}
                      <a
                        href={`https://testnet.symbol.fyi/transactions/${post.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        TX
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>

      <footer className="border-t border-zinc-800 p-6 mt-8">
        <p className="text-center text-zinc-500 text-sm">消せないから、言葉は重くなる</p>
        <p className="text-center text-zinc-600 text-xs mt-2">UNDO - 取り消せないSNS</p>
      </footer>

      <div className="fixed bottom-4 left-4 text-zinc-700 text-xs">
        <p>Ctrl+Shift+D: デモモード | G: ガイド | P: プリセット | R: リセット</p>
      </div>
    </div>
  );
}
