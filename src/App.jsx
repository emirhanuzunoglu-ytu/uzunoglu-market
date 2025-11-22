import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { 
  ShoppingCart, 
  Search, 
  User, 
  LogOut, 
  CreditCard, 
  Banknote, 
  Utensils, 
  BookOpen, 
  PauseCircle, 
  Trash2, 
  Plus, 
  Minus,
  BarChart3,
  Store,
  ChevronDown,
  X,
  Sparkles,
  ChefHat,
  Lightbulb,
  Loader2,
  RotateCcw, 
  Ban,
  Database,
  CheckCircle
} from 'lucide-react';

// --- FIREBASE CONFIG ---
// NOT: Bu bilgileri .env dosyasından çekmek en güvenlisidir.
// Vercel'de Environment Variables kısmına eklemelisin.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Firebase Başlatma (Hata önleyici kontrol ile)
let db;
try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase başlatılamadı. Config eksik olabilir.", error);
}

// --- GEMINI API SETUP ---
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY; 
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

// --- İLK KURULUM İÇİN ŞABLON VERİ SETİ ---
const INITIAL_PRODUCTS = [
  { barcode: '869001', name: 'Ekmek (200g)', price: 10.00, category: 'Temel', isQuick: true },
  { barcode: '869002', name: 'Su (0.5L)', price: 5.00, category: 'İçecek', isQuick: true },
  { barcode: '869003', name: 'Çay (1kg)', price: 180.00, category: 'Gıda', isQuick: true },
  { barcode: '869004', name: 'Şeker (1kg)', price: 35.00, category: 'Gıda', isQuick: true },
  { barcode: '869005', name: 'Süt (1L)', price: 28.00, category: 'Süt Ürünleri', isQuick: true },
  { barcode: '869006', name: 'Yumurta (15li)', price: 65.00, category: 'Kahvaltılık', isQuick: true },
  { barcode: '869007', name: 'Sigara (X Marka)', price: 60.00, category: 'Tütün', isQuick: true },
  { barcode: '869008', name: 'Kola (1L)', price: 30.00, category: 'İçecek', isQuick: true },
  { barcode: '869009', name: 'Çikolata', price: 15.00, category: 'Atıştırmalık', isQuick: true },
  { barcode: '869010', name: 'Cips', price: 25.00, category: 'Atıştırmalık', isQuick: false },
  { barcode: '869011', name: 'Makarna', price: 12.00, category: 'Gıda', isQuick: false },
  { barcode: '869012', name: 'Domates Salçası', price: 45.00, category: 'Gıda', isQuick: false },
  { barcode: '869013', name: 'Beyaz Peynir', price: 120.00, category: 'Kahvaltılık', isQuick: false },
];

const USERS = [
  { id: 1, name: 'Ahmet Uzun', role: 'Yönetici', branches: ['Merkez', 'Şube 2'] },
  { id: 2, name: 'Ayşe Yılmaz', role: 'Kasiyer', branches: ['Merkez'] },
  { id: 3, name: 'Mehmet Demir', role: 'Kasiyer', branches: ['Şube 2'] },
];

const MEAL_CARD_PROVIDERS = ['Ticket', 'Sodexo', 'Metropol', 'Setcard'];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

const App = () => {
  // --- STATE YÖNETİMİ ---
  const [products, setProducts] = useState([]); // Artık veritabanından gelecek
  const [loadingProducts, setLoadingProducts] = useState(true);
  
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [parkedCarts, setParkedCarts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [showReport, setShowReport] = useState(false);
  const [isRefundMode, setIsRefundMode] = useState(false);
  const [veresiyeName, setVeresiyeName] = useState('');
  const [showVeresiyeModal, setShowVeresiyeModal] = useState(false);
  const [showMealCardModal, setShowMealCardModal] = useState(false);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiModalTitle, setAiModalTitle] = useState('');
  const [uploadingData, setUploadingData] = useState(false); // Veri yükleme durumu
  
  const inputRef = useRef(null);

  // --- FIREBASE VERİ ÇEKME ---
  useEffect(() => {
    const fetchProducts = async () => {
      if (!db) return;
      try {
        const querySnapshot = await getDocs(collection(db, "products"));
        const productsList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        if (productsList.length > 0) {
          setProducts(productsList);
        } else {
          // Veritabanı boşsa state'i boş bırak, kullanıcı yükleme butonunu görsün
          setProducts([]); 
        }
      } catch (error) {
        console.error("Veri çekme hatası:", error);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, []);

  // --- İLK VERİLERİ YÜKLEME FONKSİYONU ---
  const uploadInitialData = async () => {
    if (!db) {
      alert("Firebase bağlantısı yapılamadı!");
      return;
    }
    if (!window.confirm("Mevcut ürün veritabanına örnek veriler yüklenecek. Onaylıyor musunuz?")) return;

    setUploadingData(true);
    const batch = writeBatch(db);
    
    try {
      // Ürünleri tek tek batch'e ekle
      INITIAL_PRODUCTS.forEach((prod) => {
        const docRef = doc(collection(db, "products")); // Yeni ID oluştur
        batch.set(docRef, prod);
      });

      await batch.commit();
      
      // Yükleme bitince verileri tekrar çek
      const querySnapshot = await getDocs(collection(db, "products"));
      const productsList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setProducts(productsList);
      
      alert("Veriler başarıyla veritabanına yüklendi! Artık panelden kullanabilirsiniz.");
    } catch (error) {
      console.error("Yükleme hatası:", error);
      alert("Bir hata oluştu: " + error.message);
    } finally {
      setUploadingData(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && !showVeresiyeModal && !showReport && !aiResponse && !showMealCardModal) {
      inputRef.current?.focus();
    }
  }, [cart, isLoggedIn, showVeresiyeModal, showReport, aiResponse, showMealCardModal, isRefundMode]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setBarcodeInput(value);

    if (value.length > 1) {
      const filtered = products.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase()) || 
        p.barcode.includes(value)
      );
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  };

  const handleLogin = (user, branch) => {
    setCurrentUser(user);
    setSelectedBranch(branch);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setSelectedBranch(null);
    setCart([]);
    setIsRefundMode(false);
  };

  const addToCart = (product) => {
    const existingItem = cart.find(item => item.barcode === product.barcode);
    if (existingItem) {
      setCart(cart.map(item => 
        item.barcode === product.barcode 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setBarcodeInput('');
    setSearchResults([]);
  };

  const removeFromCart = (barcode) => {
    setCart(cart.filter(item => item.barcode !== barcode));
  };

  const cancelReceipt = () => {
    if (window.confirm('Fiş iptal edilecek. Onaylıyor musunuz?')) {
      setCart([]);
      setIsRefundMode(false);
    }
  };

  const updateQuantity = (barcode, change) => {
    setCart(cart.map(item => {
      if (item.barcode === barcode) {
        const newQty = Math.max(1, item.quantity + change);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const exactMatch = products.find(p => p.barcode === barcodeInput);
    
    if (exactMatch) {
      addToCart(exactMatch);
    } else if (searchResults.length === 1) {
      addToCart(searchResults[0]);
    } else {
      if (searchResults.length === 0) alert('Ürün bulunamadı!');
    }
  };

  const parkCart = () => {
    if (cart.length === 0) return;
    const newSlotId = parkedCarts.length + 1;
    const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    
    setParkedCarts([...parkedCarts, {
      id: newSlotId,
      items: cart,
      total: calculateTotal(),
      time: timestamp
    }]);
    setCart([]);
  };

  const retrieveParkedCart = (slotId) => {
    if (cart.length > 0) {
      if (!window.confirm('Mevcut sepet silinecek?')) return;
    }
    const parkedCart = parkedCarts.find(p => p.id === slotId);
    setCart(parkedCart.items);
    setParkedCarts(parkedCarts.filter(p => p.id !== slotId));
  };

  const completeSale = async (paymentType, customerName = null) => {
    if (cart.length === 0) return;

    const totalAmount = calculateTotal();
    const finalTotal = isRefundMode ? -totalAmount : totalAmount;
    const finalType = isRefundMode ? `İADE (${paymentType})` : paymentType;

    const newTransaction = {
      items: cart, // Firestore array olarak kaydedecek
      total: finalTotal,
      type: finalType,
      isRefund: isRefundMode,
      customer: customerName,
      branch: selectedBranch,
      user: currentUser.name,
      timestamp: new Date() // Firestore Timestamp
    };

    // İşlemi Firestore'a kaydet
    if(db) {
      try {
        await addDoc(collection(db, "transactions"), newTransaction);
      } catch(e) {
        console.error("Satış kaydedilemedi", e);
      }
    }

    // Lokal state güncelle
    setTransactions([...transactions, { ...newTransaction, time: new Date().toLocaleTimeString() }]);
    
    setCart([]);
    setVeresiyeName('');
    setShowVeresiyeModal(false);
    setShowMealCardModal(false);
    setIsRefundMode(false);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // --- AI FONKSİYONLARI ---
  const generateRecipe = async () => {
    if (cart.length === 0) return;
    setAiLoading(true);
    setAiModalTitle('✨ Müşteriniz İçin Özel Tarif');
    try {
      const ingredients = cart.map(item => item.name).join(', ');
      const prompt = `Market kasasındayım. Sepet: ${ingredients}. Bu malzemelerle pratik Türk yemeği tarifi ver. Kısa olsun.`;
      const result = await model.generateContent(prompt);
      setAiResponse(result.response.text());
    } catch (error) {
      setAiResponse("Bağlantı hatası veya kota dolu.");
    } finally {
      setAiLoading(false);
    }
  };

  const generateProductSuggestion = async () => {
    if (cart.length === 0) return;
    setAiLoading(true);
    setAiModalTitle('✨ Akıllı Satış Önerisi');
    try {
      const ingredients = cart.map(item => item.name).join(', ');
      const prompt = `Sepet: ${ingredients}. Yanına satabileceğim 3 tamamlayıcı ürün öner. Türkçe.`;
      const result = await model.generateContent(prompt);
      setAiResponse(result.response.text());
    } catch (error) {
      setAiResponse("Bağlantı hatası veya kota dolu.");
    } finally {
      setAiLoading(false);
    }
  };

  const getDailyStats = () => {
    const stats = {
      total: 0,
      cash: 0,
      card: 0,
      mealCard: 0,
      veresiye: 0,
      refundTotal: 0,
      count: transactions.length
    };

    transactions.forEach(t => {
      stats.total += t.total;
      if (t.isRefund) {
        stats.refundTotal += Math.abs(t.total);
      } else {
        if (t.type === 'Nakit') stats.cash += t.total;
        if (t.type === 'Kredi Kartı') stats.card += t.total;
        if (t.type.includes('Yemek Kartı')) stats.mealCard += t.total;
        if (t.type === 'Veresiye') stats.veresiye += t.total;
      }
    });
    return stats;
  };

  // --- LOGIN & YÜKLEME EKRANI ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800">Uzunoğlu Market</h1>
            <p className="text-slate-500">Bulut Tabanlı POS Sistemi</p>
            {loadingProducts && <p className="text-xs text-orange-500 mt-2 animate-pulse">Veritabanına bağlanılıyor...</p>}
          </div>
          
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-700">Kullanıcı Seçin</h3>
            <div className="grid gap-3">
              {USERS.map(user => (
                <button 
                  key={user.id}
                  onClick={() => setCurrentUser(user)}
                  className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all
                    ${currentUser?.id === user.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-600">
                      <User size={20} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800">{user.name}</div>
                      <div className="text-xs text-slate-500">{user.role}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {currentUser && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300 mt-6">
                <h3 className="font-semibold text-slate-700 mb-3">Şube Seçin</h3>
                <div className="grid grid-cols-2 gap-3">
                  {currentUser.branches.map(branch => (
                    <button
                      key={branch}
                      onClick={() => handleLogin(currentUser, branch)}
                      className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold shadow-lg flex flex-col items-center gap-2"
                    >
                      <Store />
                      {branch}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* VERİTABANI YÜKLEME BUTONU (SADECE VERİ YOKSA GÖZÜKÜR VEYA YÖNETİCİ GÖREBİLİR) */}
            <div className="pt-6 mt-6 border-t border-slate-100">
              <button 
                onClick={uploadInitialData}
                disabled={uploadingData}
                className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-blue-600 py-2"
              >
                {uploadingData ? <Loader2 className="animate-spin" size={14}/> : <Database size={14} />}
                {products.length === 0 ? "İlk Kurulum: Veritabanına Ürünleri Yükle" : "Veritabanı Durumu: Aktif"}
                {products.length > 0 && <CheckCircle size={14} className="text-green-500"/>}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- MAIN APP ---
  return (
    <div className={`h-screen flex flex-col font-sans overflow-hidden transition-colors duration-300 ${isRefundMode ? 'bg-red-50' : 'bg-slate-100'}`}>
      
      {/* HEADER */}
      <header className={`${isRefundMode ? 'bg-red-800' : 'bg-slate-800'} text-white px-4 py-2 flex justify-between items-center shadow-md shrink-0 transition-colors duration-300`}>
        <div className="flex items-center gap-4">
          <div className={`${isRefundMode ? 'bg-red-600' : 'bg-orange-500'} p-2 rounded-lg transition-colors`}>
            <ShoppingCart size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Uzunoğlu Market</h1>
            <div className="flex items-center gap-2 text-xs opacity-70">
              <span className="bg-white/20 px-2 py-0.5 rounded text-white">{selectedBranch}</span>
              <span className="bg-green-500/20 text-green-200 px-2 py-0.5 rounded flex items-center gap-1">
                <Database size={10}/> Online
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowReport(!showReport)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors"
            >
              <BarChart3 size={18} />
              <span>Gün Sonu Raporu</span>
              <ChevronDown size={14} />
            </button>
            
            {showReport && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-white text-slate-800 rounded-xl shadow-2xl z-50 p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h3 className="font-bold text-lg">Günlük Rapor</h3>
                  <button onClick={() => setShowReport(false)}><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Toplam İşlem:</span> <span className="font-mono font-bold">{getDailyStats().count}</span></div>
                  <div className="flex justify-between text-sm text-green-600"><span className="flex items-center gap-2"><Banknote size={14}/> Nakit:</span> <span className="font-mono font-bold">{formatCurrency(getDailyStats().cash)}</span></div>
                  <div className="flex justify-between text-sm text-blue-600"><span className="flex items-center gap-2"><CreditCard size={14}/> K. Kartı:</span> <span className="font-mono font-bold">{formatCurrency(getDailyStats().card)}</span></div>
                  <div className="flex justify-between text-sm text-orange-600"><span className="flex items-center gap-2"><Utensils size={14}/> Yemek K.:</span> <span className="font-mono font-bold">{formatCurrency(getDailyStats().mealCard)}</span></div>
                  <div className="flex justify-between text-sm text-red-600"><span className="flex items-center gap-2"><BookOpen size={14}/> Veresiye:</span> <span className="font-mono font-bold">{formatCurrency(getDailyStats().veresiye)}</span></div>
                  <div className="flex justify-between text-sm text-rose-600 border-t border-slate-100 pt-2"><span className="flex items-center gap-2 font-bold"><RotateCcw size={14}/> İadeler:</span> <span className="font-mono font-bold">-{formatCurrency(getDailyStats().refundTotal)}</span></div>
                  <div className="pt-3 mt-2 border-t border-slate-200 flex justify-between font-bold text-lg text-slate-800">
                    <span>NET CİRO:</span>
                    <span>{formatCurrency(getDailyStats().total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 border-l border-white/20 pl-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{currentUser.name}</div>
              <div className="text-xs opacity-70">{currentUser.role}</div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 text-white rounded-full transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SOL PANEL */}
        <div className="w-full lg:w-7/12 flex flex-col border-r border-slate-200 bg-white">
          <div className="p-4 border-b border-slate-100 bg-slate-50 relative z-30">
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input 
                ref={inputRef}
                type="text" 
                value={barcodeInput}
                onChange={handleInputChange}
                placeholder={loadingProducts ? "Veriler yükleniyor..." : "Barkod Okutun veya Ürün Adı Yazın..."}
                disabled={loadingProducts}
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-lg shadow-sm disabled:bg-slate-100"
                autoFocus
              />
            </form>
            {searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 max-h-60 overflow-y-auto z-40 mx-4">
                {searchResults.map(product => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="w-full p-3 text-left hover:bg-blue-50 flex justify-between items-center border-b border-slate-50 last:border-0 group"
                  >
                    <div>
                      <div className="font-bold text-slate-700 group-hover:text-blue-600">{product.name}</div>
                      <div className="text-xs text-slate-400">{product.barcode}</div>
                    </div>
                    <div className="font-bold text-slate-800">{formatCurrency(product.price)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                <ShoppingCart size={64} className={isRefundMode ? 'text-red-200' : 'text-slate-200'} />
                <p className="text-xl font-medium">{isRefundMode ? 'İADE İŞLEMİ İÇİN ÜRÜN EKLEYİN' : 'Sepet Boş'}</p>
                <p className="text-sm opacity-60">
                  {loadingProducts ? "Ürün veritabanı bağlanıyor..." : "Ürün arayın veya barkod okutun."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-slate-500 text-sm border-b">
                    <th className="p-3 font-medium">Ürün Adı</th>
                    <th className="p-3 font-medium w-24">Adet</th>
                    <th className="p-3 font-medium w-24">Fiyat</th>
                    <th className="p-3 font-medium w-24">Tutar</th>
                    <th className="p-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {cart.map((item, index) => (
                    <tr key={index} className={`border-b transition-colors group ${isRefundMode ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-slate-50'}`}>
                      <td className="p-3 font-medium">
                        <div>{item.name}</div>
                        <div className="text-xs text-slate-400">{item.barcode}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 bg-white border rounded-lg w-fit px-1 shadow-sm">
                          <button onClick={() => updateQuantity(item.barcode, -1)} className="p-1 hover:bg-slate-100 rounded"><Minus size={14}/></button>
                          <span className="w-6 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.barcode, 1)} className="p-1 hover:bg-slate-100 rounded"><Plus size={14}/></button>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{formatCurrency(item.price)}</td>
                      <td className={`p-3 font-bold ${isRefundMode ? 'text-red-600' : 'text-slate-800'}`}>
                        {isRefundMode ? '-' : ''}{formatCurrency(item.price * item.quantity)}
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => removeFromCart(item.barcode)} className="text-slate-300 hover:text-red-500 p-1">
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {parkedCarts.length > 0 && (
            <div className="p-2 bg-slate-100 border-t border-slate-200 flex gap-2 overflow-x-auto">
              {parkedCarts.map((slot) => (
                <button 
                  key={slot.id}
                  onClick={() => retrieveParkedCart(slot.id)}
                  className="flex flex-col items-start p-2 bg-white border-l-4 border-orange-400 rounded shadow-sm hover:shadow-md min-w-[140px] transition-all"
                >
                  <div className="text-xs text-slate-500 font-bold flex items-center gap-1">
                    <PauseCircle size={12} /> Fiş #{slot.id}
                  </div>
                  <div className="text-xs text-slate-400">{slot.time}</div>
                  <div className="font-bold text-slate-800 mt-1">{formatCurrency(slot.total)}</div>
                </button>
              ))}
            </div>
          )}

          <div className={`p-4 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 transition-colors ${isRefundMode ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <div className="flex gap-3 mb-3 overflow-x-auto pb-2 items-center">
               <button 
                  onClick={() => setIsRefundMode(!isRefundMode)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-bold whitespace-nowrap border-2
                    ${isRefundMode ? 'bg-red-600 text-white border-red-600 shadow-lg shadow-red-300' : 'bg-white text-slate-500 border-slate-200 hover:border-red-400 hover:text-red-500'}`}
                >
                  <RotateCcw size={16} className={isRefundMode ? 'animate-spin-slow' : ''} />
                  {isRefundMode ? 'İADE MODU AKTİF' : 'İade İşlemi'}
               </button>
               <button 
                  onClick={cancelReceipt}
                  disabled={cart.length === 0}
                  className="flex items-center gap-2 bg-red-100 text-red-700 px-3 py-2 rounded-lg hover:bg-red-200 transition-colors text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  <Ban size={16} />
                  Fiş İptal
                </button>
               <div className="h-6 w-px bg-slate-300 mx-1"></div>
               <button 
                  onClick={generateRecipe}
                  disabled={cart.length === 0 || aiLoading}
                  className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 transition-colors text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <ChefHat size={16} />}
                  Tarif Öner
                </button>
                <button 
                  onClick={generateProductSuggestion}
                  disabled={cart.length === 0 || aiLoading}
                  className="flex items-center gap-2 bg-teal-100 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-200 transition-colors text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <Lightbulb size={16} />}
                  Ürün Tavsiyesi
                </button>
            </div>
            <div className="flex justify-between items-end">
              <div>
                 <div className="text-sm text-slate-500 mb-1">Toplam Ürün: {cart.reduce((a, b) => a + b.quantity, 0)}</div>
                 <button 
                  onClick={parkCart}
                  disabled={cart.length === 0}
                  className="flex items-center gap-2 text-orange-600 bg-orange-50 hover:bg-orange-100 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <PauseCircle size={20} />
                  <span className="font-semibold">Müşteri Beklet</span>
                </button>
              </div>
              <div className="text-right">
                <div className={`text-sm font-bold ${isRefundMode ? 'text-red-600' : 'text-slate-500'}`}>
                  {isRefundMode ? 'İADE EDİLECEK TUTAR' : 'Genel Toplam'}
                </div>
                <div className={`text-4xl font-extrabold tracking-tight ${isRefundMode ? 'text-red-600' : 'text-slate-800'}`}>
                  {isRefundMode ? '-' : ''}{formatCurrency(calculateTotal())}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ PANEL */}
        <div className="w-full lg:w-5/12 bg-slate-50 flex flex-col h-full">
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Hızlı Ürünler</h2>
            {loadingProducts ? (
              <div className="flex items-center justify-center h-40 text-slate-400">
                 <Loader2 className="animate-spin mr-2" /> Ürünler Yükleniyor...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {products.filter(p => p.isQuick).map((product) => (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all text-left group"
                  >
                    <div className="font-semibold text-slate-700 group-hover:text-blue-600 line-clamp-2 h-10">
                      {product.name}
                    </div>
                    <div className="flex justify-between items-end mt-2">
                      <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">{product.category}</span>
                      <span className="font-bold text-slate-800">{product.price}₺</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={`p-4 border-t shadow-lg transition-colors ${isRefundMode ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
            <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${isRefundMode ? 'text-red-600' : 'text-slate-500'}`}>
              {isRefundMode ? 'İade Yöntemi Seçin' : 'Ödeme Tipi'}
            </h2>
            <div className="grid grid-cols-2 gap-3 h-48">
              <button 
                onClick={() => completeSale('Nakit')}
                disabled={cart.length === 0}
                className={`${isRefundMode ? 'bg-red-600 hover:bg-red-700 shadow-red-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200'} text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-95`}
              >
                <Banknote size={32} />
                <span className="text-xl font-bold">{isRefundMode ? 'NAKİT İADE' : 'NAKİT'}</span>
              </button>
              <button 
                onClick={() => completeSale('Kredi Kartı')}
                disabled={cart.length === 0}
                className={`${isRefundMode ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'} text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50 disabled:shadow-none active:scale-95`}
              >
                <CreditCard size={32} />
                <span className="text-xl font-bold">{isRefundMode ? 'KARTA İADE' : 'KART'}</span>
              </button>
              <button 
                onClick={() => setShowMealCardModal(true)}
                disabled={cart.length === 0 || isRefundMode}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-orange-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95 relative overflow-hidden"
              >
                {isRefundMode && <div className="absolute inset-0 bg-white/50 flex items-center justify-center text-slate-800 font-bold text-xs">İADE DIŞI</div>}
                <Utensils size={24} />
                <span className="font-bold">YEMEK KARTI</span>
                <span className="text-xs opacity-80">Seçim Yapın</span>
              </button>
              <button 
                onClick={() => setShowVeresiyeModal(true)}
                disabled={cart.length === 0 || isRefundMode}
                className="bg-slate-500 hover:bg-slate-600 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95 relative overflow-hidden"
              >
                 {isRefundMode && <div className="absolute inset-0 bg-white/50 flex items-center justify-center text-slate-800 font-bold text-xs">İADE DIŞI</div>}
                <BookOpen size={24} />
                <span className="font-bold">VERESİYE</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showVeresiyeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
              <BookOpen className="text-red-500" /> Veresiye İşlemi
            </h2>
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı / Cari Hesap</label>
              <input 
                type="text"
                value={veresiyeName}
                onChange={(e) => setVeresiyeName(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="Örn: Ahmet Yılmaz"
                autoFocus
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowVeresiyeModal(false)}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button 
                onClick={() => completeSale('Veresiye', veresiyeName || 'İsimsiz Cari')}
                className="px-5 py-2.5 bg-slate-700 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-lg"
              >
                İşlemi Tamamla
              </button>
            </div>
          </div>
        </div>
      )}

      {showMealCardModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Utensils className="text-orange-500" /> Kart Seçimi
              </h2>
              <button onClick={() => setShowMealCardModal(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-2">
              {MEAL_CARD_PROVIDERS.map(provider => (
                <button
                  key={provider}
                  onClick={() => completeSale(`Yemek Kartı (${provider})`)}
                  className="p-4 border-2 border-orange-100 hover:border-orange-500 hover:bg-orange-50 rounded-xl font-bold text-slate-700 transition-all text-center"
                >
                  {provider}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {(aiLoading || aiResponse) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-in fade-in zoom-in duration-200 relative">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {aiLoading ? <Sparkles className="text-purple-500 animate-pulse"/> : <Sparkles className="text-purple-600"/>}
                {aiModalTitle}
              </h2>
              {!aiLoading && (
                <button onClick={() => setAiResponse(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              )}
            </div>
            <div className="min-h-[150px]">
              {aiLoading ? (
                <div className="flex flex-col items-center justify-center h-40 space-y-4">
                  <Loader2 className="animate-spin text-purple-600" size={48} />
                  <p className="text-slate-500 font-medium animate-pulse">Yapay zeka düşünüyor...</p>
                </div>
              ) : (
                <div className="prose prose-slate prose-sm max-w-none">
                   <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
                     {aiResponse}
                   </div>
                </div>
              )}
            </div>
            {!aiLoading && (
              <div className="mt-6 flex justify-end">
                <button 
                  onClick={() => setAiResponse(null)}
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium transition-colors"
                >
                  Tamam
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;