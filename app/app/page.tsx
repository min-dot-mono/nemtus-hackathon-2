'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getUserAccount,
  saveUserAccount,
  getLocalPosts,
  addLocalPost,
  clearAllData,
  type UserAccount,
  type Post,
} from '@/lib/storage';

// デモ用プリセット文章
const PRESET_MESSAGES = [
  { label: '哲学的', text: '自由とは、責任を引き受けることだ。' },
  { label: '宣言', text: '私はこの発言に責任を持つ。' },
  { label: 'ユーモア', text: 'このSNS、怖すぎる。でも使う。' },
  { label: 'ハッカソン', text: 'NEMTUS Hackathon 2026、最高！' },
];

export default function Home() {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
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
  const [showSuccess, setShowSuccess] = useState(false);
  const [successHash, setSuccessHash] = useState('');
  const [showPresenterGuide, setShowPresenterGuide] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

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
    try {
      const res = await fetch(`/api/balance?address=${address}`);
      const data = await res.json();
      setBalance(BigInt(data.balance || '0'));
    } catch (e) {
      console.error('Failed to fetch balance:', e);
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

  // アカウント変更時に残高取得
  useEffect(() => {
    if (account) {
      fetchBalance(account.address);
      setPosts(getLocalPosts());
    }
  }, [account, fetchBalance]);

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

      const post: Post = {
        hash,
        message: newPost,
        address: account.address,
        timestamp: Date.now(),
        likes: 0,
      };
      addLocalPost(post);
      setPosts([post, ...posts]);
      setNewPost('');
      setShowConfirm(false);
      setSuccessHash(hash);
      setShowSuccess(true);
      if (showPresenterGuide) setCurrentStep(4);

      // 残高更新
      if (!demoMode) {
        setTimeout(() => fetchBalance(account.address), 2000);
      }

      setTimeout(() => setShowSuccess(false), 3000);
    } catch (e) {
      setError(`投稿に失敗しました: ${e}`);
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

  // ローディング画面
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-red-600 mb-4 animate-pulse">UNDO</h1>
          <p className="text-zinc-500">Loading...</p>
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

      <header className="border-b border-zinc-800 p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold text-red-600">UNDO</h1>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>{(Number(balance) / 1000000).toFixed(2)} XYM</span>
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
        {account && (
          <div className="mb-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <p className="text-xs text-zinc-500 mb-1">あなたのアドレス（Symbol Testnet）</p>
            <p className="text-sm font-mono text-zinc-300 break-all">{account.address}</p>
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
                  Explorer で見る →
                </a>
                {balance === 0n && (
                  <p className="text-xs text-yellow-500 mt-2">
                    ⚠️ 残高がありません。
                    <a href="https://testnet.symbol.tools/" target="_blank" rel="noopener noreferrer" className="underline ml-1">
                      Faucetで取得 →
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
              <div className="text-center mb-4"><span className="text-4xl">⚠️</span></div>
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
                  {isPosting ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⏳</span>記録中...</span> : '覚悟を決めて投稿'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccess && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full border-2 border-green-600 shadow-2xl shadow-green-900/30 text-center">
              <div className="text-6xl mb-4 animate-bounce">✓</div>
              <h2 className="text-2xl font-bold text-green-500 mb-2">ブロックチェーンに記録されました</h2>
              <p className="text-zinc-400 text-sm mb-4">この投稿は永久に保存されます</p>
              <div className="bg-black p-3 rounded-lg border border-zinc-700">
                <p className="text-xs text-zinc-500 mb-1">Transaction Hash</p>
                <p className="text-xs font-mono text-zinc-400 break-all">{successHash}</p>
              </div>
              {!demoMode && !successHash.startsWith('DEMO_') && (
                <a
                  href={`https://testnet.symbol.fyi/transactions/${successHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-4 text-sm text-green-500 hover:underline"
                >
                  Explorer で確認 →
                </a>
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
            <h2 className="text-lg font-bold text-zinc-300">投稿一覧</h2>
            <p className="text-xs text-zinc-600">削除ボタンはありません</p>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-12 bg-zinc-900/50 rounded-lg border border-zinc-800">
              <p className="text-zinc-500 text-lg">まだ投稿がありません</p>
              <p className="text-zinc-600 text-sm mt-2">最初の一歩を踏み出しましょう</p>
            </div>
          ) : (
            posts.map((post) => (
              <div key={post.hash} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 relative">
                <div className="absolute -top-2 -right-2 bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full border border-red-700">削除不可</div>
                <p className="text-white whitespace-pre-wrap mb-4 text-lg leading-relaxed">{post.message}</p>
                <div className="flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-zinc-800">
                  <span>{new Date(post.timestamp).toLocaleString('ja-JP')}</span>
                  <div className="flex items-center gap-4">
                    {!post.hash.startsWith('DEMO_') && (
                      <a
                        href={`https://testnet.symbol.fyi/transactions/${post.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        TX →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-8 p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg">
          <p className="text-zinc-500 text-sm text-center">
            💡 すべての投稿はブロックチェーンに記録され、<br />
            <span className="text-red-400 font-bold">誰にも削除・編集できません</span>
          </p>
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
