import React, { useState, useEffect } from 'react';
import { 
  Clock, Trash2, Save, CheckCircle, 
  Briefcase, BookOpen, Coffee, Utensils, 
  Dumbbell, Moon, MoreHorizontal, 
  PenTool, List, History, Calendar, Sparkles, Copy
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';

// --- Config & Initialization ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// カテゴリ設定
const CATEGORIES = [
  { id: 'work', label: '仕事', icon: Briefcase, color: 'from-blue-500 to-cyan-500', shadow: 'shadow-blue-200' },
  { id: 'study', label: '勉強', icon: BookOpen, color: 'from-emerald-500 to-teal-500', shadow: 'shadow-emerald-200' },
  { id: 'break', label: '休憩', icon: Coffee, color: 'from-amber-400 to-orange-400', shadow: 'shadow-orange-200' },
  { id: 'meal', label: '食事', icon: Utensils, color: 'from-rose-400 to-red-400', shadow: 'shadow-rose-200' },
  { id: 'exercise', label: '運動', icon: Dumbbell, color: 'from-violet-500 to-purple-500', shadow: 'shadow-purple-200' },
  { id: 'sleep', label: '睡眠', icon: Moon, color: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-200' },
  { id: 'other', label: 'その他', icon: MoreHorizontal, color: 'from-gray-500 to-slate-500', shadow: 'shadow-gray-200' },
];

export default function ActivityLogApp() {
  const [user, setUser] = useState(null);
  const [records, setRecords] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('work');
  const [memo, setMemo] = useState('');
  const [lastSaved, setLastSaved] = useState(null);
  const [activeTab, setActiveTab] = useState('input');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiReport, setAiReport] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'logs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedRecords = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate() || new Date(), 
      }));
      loadedRecords.sort((a, b) => b.timestamp - a.timestamp);
      setRecords(loadedRecords);
    });
    return () => unsubscribe();
  }, [user]);

  const handleAddRecord = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'logs'), {
        timestamp: serverTimestamp(),
        category: selectedCategory,
        memo: memo,
      });
      setMemo('');
      setLastSaved(new Date());
      setTimeout(() => setLastSaved(null), 3000);
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("保存に失敗しました");
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!user) return;
    if (window.confirm('削除しますか？')) {
      await deleteDoc(doc(db, 'users', user.uid, 'logs', id));
    }
  };

  const generateDailyReport = async () => {
    setIsGenerating(true);
    setShowReportModal(true);
    setAiReport('');

    try {
      const today = new Date();
      const todaysRecords = records.filter(r => {
        const rDate = new Date(r.timestamp);
        return rDate.getDate() === today.getDate() && 
               rDate.getMonth() === today.getMonth() && 
               rDate.getFullYear() === today.getFullYear();
      });

      if (todaysRecords.length === 0) {
        setAiReport("今日の記録がまだありません。");
        setIsGenerating(false);
        return;
      }

      const logText = todaysRecords.map(r => {
        const time = r.timestamp.toLocaleTimeString('ja-JP', {hour:'2-digit', minute:'2-digit'});
        const cat = CATEGORIES.find(c => c.id === r.category)?.label;
        return `- ${time} [${cat}] ${r.memo}`;
      }).reverse().join('\n');

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      const prompt = `
        あなたは優秀なライフログ・アシスタントです。以下のログをもとに1日のまとめを作成してください。
        文体は「〜ですね！」等の明るい口調で。マークダウン形式で出力してください。
        ログ:\n${logText}
      `;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );

      const data = await response.json();
      setAiReport(data.candidates?.[0]?.content?.parts?.[0]?.text || "生成失敗");
    } catch (error) {
      console.error("AI Error:", error);
      setAiReport("エラーが発生しました。");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyForNotion = () => {
    const text = `# 日報\n\n${aiReport}\n\n## 詳細\n${records.map(r => `- ${r.timestamp.toLocaleTimeString('ja-JP')} ${r.memo}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    alert('コピーしました！');
  };
  
  const currentCat = CATEGORIES.find(c => c.id === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 text-slate-800 font-sans pb-24 md:pb-10">
      <header className="bg-white/70 backdrop-blur-md border-b border-white/50 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">Life Logger AI</h1>
          <button onClick={generateDailyReport} className="flex items-center gap-2 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white text-xs font-bold px-4 py-2 rounded-full shadow-md">
            <Sparkles size={14} /> <span className="hidden sm:inline">まとめ作成</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
        <section className={`md:col-span-5 ${activeTab === 'input' ? 'block' : 'hidden'} md:block`}>
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl p-6 border border-white/60 relative overflow-hidden">
             <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700"><PenTool className="w-5 h-5 text-indigo-500" /> 記録</h2>
             <div className="grid grid-cols-3 gap-3 mb-6">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`flex flex-col items-center p-2 rounded-xl transition-all ${selectedCategory === cat.id ? `bg-gradient-to-br ${cat.color} text-white shadow-lg` : 'bg-slate-50 text-slate-500'}`}>
                    <Icon className="w-6 h-6" /> <span className="text-xs font-bold mt-1">{cat.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="メモ" className="w-full p-4 bg-slate-50 border rounded-2xl mb-6 h-24" />
            <button onClick={handleAddRecord} className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl shadow-lg flex items-center justify-center gap-2"><Save className="w-5 h-5" /> 保存</button>
            {lastSaved && <div className="mt-4 text-emerald-600 font-bold text-center flex justify-center gap-2"><CheckCircle /> 保存しました</div>}
          </div>
        </section>

        <section className={`md:col-span-7 ${activeTab === 'history' ? 'block' : 'hidden'} md:block`}>
          <div className="bg-white/60 backdrop-blur-md rounded-3xl shadow-xl p-6 border border-white/60 min-h-[500px]">
            <h2 className="text-lg font-bold mb-4 flex gap-2"><History /> 履歴 ({records.length})</h2>
            <div className="space-y-3 overflow-y-auto max-h-[60vh]">
              {records.map((r) => (
                <div key={r.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-start">
                  <div>
                    <div className="text-xs font-bold text-slate-400">{r.timestamp.toLocaleString('ja-JP')}</div>
                    <div className="font-bold text-indigo-600">{CATEGORIES.find(c => c.id === r.category)?.label}</div>
                    <div className="text-sm text-slate-700 mt-1">{r.memo}</div>
                  </div>
                  <button onClick={() => handleDeleteRecord(r.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[80vh]">
            <div className="bg-gradient-to-r from-fuchsia-600 to-pink-600 p-6 text-white flex justify-between"><h3 className="font-bold flex gap-2"><Sparkles /> AIまとめ</h3><button onClick={() => setShowReportModal(false)}>×</button></div>
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 whitespace-pre-wrap">{isGenerating ? "AIが分析中..." : aiReport}</div>
            <div className="p-4 bg-white border-t flex justify-end gap-3">
              <button onClick={copyForNotion} className="px-5 py-3 bg-slate-100 font-bold rounded-xl flex gap-2"><Copy /> Notionへコピー</button>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-6 left-4 right-4 bg-slate-900/95 text-white rounded-full p-2 shadow-2xl flex justify-between z-40">
        <button onClick={() => setActiveTab('input')} className={`flex-1 py-3 rounded-full flex justify-center gap-2 ${activeTab === 'input' ? 'bg-white/20' : 'text-slate-400'}`}><PenTool /> 記録</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 rounded-full flex justify-center gap-2 ${activeTab === 'history' ? 'bg-white/20' : 'text-slate-400'}`}><List /> 履歴</button>
      </nav>
    </div>
  );
}