import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  PlayCircle, 
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
  Loader2
} from 'lucide-react';

// --- GEMINI API SETUP ---
// Not: Gerçek kullanımda API anahtarınızı güvenli bir şekilde saklayın.
const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

// --- SAHTE VERİ SETİ (VERİTABANI SİMÜLASYONU) ---

const PRODUCTS = [
  { barcode: '869001', name: 'Ekmek (200g)', price: 10.00, category: 'Temel' },
  { barcode: '869002', name: 'Su (0.5L)', price: 5.00, category: 'İçecek' },
  { barcode: '869003', name: 'Çay (1kg)', price: 180.00, category: 'Gıda' },
  { barcode: '869004', name: 'Şeker (1kg)', price: 35.00, category: 'Gıda' },
  { barcode: '869005', name: 'Süt (1L)', price: 28.00, category: 'Süt Ürünleri' },
  { barcode: '869006', name: 'Yumurta (15li)', price: 65.00, category: 'Kahvaltılık' },
  { barcode: '869007', name: 'Sigara (X Marka)', price: 60.00, category: 'Tütün' },
  { barcode: '869008', name: 'Kola (1L)', price: 30.00, category: 'İçecek' },
  { barcode: '869009', name: 'Çikolata', price: 15.00, category: 'Atıştırmalık' },
  { barcode: '869010', name: 'Cips', price: 25.00, category: 'Atıştırmalık' },
  { barcode: '869011', name: 'Makarna', price: 12.00, category: 'Gıda' },
  { barcode: '869012', name: 'Domates Salçası', price: 45.00, category: 'Gıda' },
  { barcode: '869013', name: 'Beyaz Peynir', price: 120.00, category: 'Kahvaltılık' },
];

const QUICK_PRODUCTS = PRODUCTS.slice(0, 9); // Sağ paneldeki hızlı ürünler

const USERS = [
  { id: 1, name: 'Ahmet Uzun', role: 'Yönetici', branches: ['Merkez', 'Şube 2'] },
  { id: 2, name: 'Ayşe Yılmaz', role: 'Kasiyer', branches: ['Merkez'] },
  { id: 3, name: 'Mehmet Demir', role: 'Kasiyer', branches: ['Şube 2'] },
];

// --- YARDIMCI FONKSİYONLAR ---

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
};

const App = () => {
  // --- STATE YÖNETİMİ ---
  
  // Oturum State'leri
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Satış State'leri
  const [cart, setCart] = useState([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [parkedCarts, setParkedCarts] = useState([]); // Bekleyen fişler slotları
  const [transactions, setTransactions] = useState([]); // Günlük işlem geçmişi
  
  // UI State'leri
  const [showReport, setShowReport] = useState(false);
  const [veresiyeName, setVeresiyeName] = useState('');
  const [showVeresiyeModal, setShowVeresiyeModal] = useState(false);
  
  // AI State'leri
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [aiModalTitle, setAiModalTitle] = useState('');
  
  const inputRef = useRef(null);

  // Her renderda input'a odaklan (Barkod okuyucu simülasyonu için)
  useEffect(() => {
    if (isLoggedIn && !showVeresiyeModal && !showReport && !aiResponse) {
      inputRef.current?.focus();
    }
  }, [cart, isLoggedIn, showVeresiyeModal, showReport, aiResponse]);

  // --- İŞ MANTIĞI ---

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
  };

  const removeFromCart = (barcode) => {
    setCart(cart.filter(item => item.barcode !== barcode));
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
    const product = PRODUCTS.find(p => p.barcode === barcodeInput);
    if (product) {
      addToCart(product);
      setBarcodeInput('');
    } else {
      alert('Ürün bulunamadı!');
      setBarcodeInput('');
    }
  };

  // Beklemeye Al
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

  // Bekleyeni Geri Çağır
  const retrieveParkedCart = (slotId) => {
    if (cart.length > 0) {
      if (!window.confirm('Şu anki sepet silinecek, devam edilsin mi?')) return;
    }
    const parkedCart = parkedCarts.find(p => p.id === slotId);
    setCart(parkedCart.items);
    setParkedCarts(parkedCarts.filter(p => p.id !== slotId));
  };

  // Satışı Tamamla
  const completeSale = (type, customerName = null) => {
    if (cart.length === 0) return;

    const total = calculateTotal();
    const newTransaction = {
      id: Date.now(),
      items: [...cart],
      total: total,
      type: type, // Nakit, Kredi, Yemek, Veresiye
      customer: customerName,
      branch: selectedBranch,
      user: currentUser.name,
      time: new Date().toLocaleTimeString()
    };

    setTransactions([...transactions, newTransaction]);
    setCart([]);
    setVeresiyeName('');
    setShowVeresiyeModal(false);
    
    // Ses efekti simülasyonu (Console log)
    console.log(`Satış Tamamlandı: ${type} - ${total} TL`);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  };

  // --- AI GEMINI ENTEGRASYONU ---

  const generateRecipe = async () => {
    if (cart.length === 0) return;
    setAiLoading(true);
    setAiModalTitle('✨ Müşteriniz İçin Özel Tarif');
    
    try {
      const ingredients = cart.map(item => item.name).join(', ');
      const prompt = `Bir market kasasındayım. Müşterinin sepetinde şu ürünler var: ${ingredients}. Bu malzemelerin çoğunu kullanarak yapılabilecek tek bir, pratik ve lezzetli Türk yemeği tarifi ver. Format: Yemek Adı, Malzemeler (kısa liste), Yapılışı (2-3 cümle). Çok uzun olmasın. Samimi bir dille yaz.`;
      
      const result = await model.generateContent(prompt);
      setAiResponse(result.response.text());
    } catch (error) {
      console.error(error);
      setAiResponse("Üzgünüm, şu anda yapay zeka servisine ulaşılamıyor. Lütfen tekrar deneyin.");
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
      const prompt = `Bir market kasiyeriyim. Müşterinin sepetinde bunlar var: ${ingredients}. Bu müşteriye, sepetindeki ürünlerle uyumlu olabilecek ve onu memnun edecek 3 adet tamamlayıcı ürün önerisi yap (Örneğin makarna aldıysa sos veya peynir öner gibi). Sadece ürün isimlerini ve neden önerdiğini 1 cümleyle yaz. Türkçe cevap ver.`;
      
      const result = await model.generateContent(prompt);
      setAiResponse(result.response.text());
    } catch (error) {
      console.error(error);
      setAiResponse("Öneri sistemi şu an yanıt vermiyor.");
    } finally {
      setAiLoading(false);
    }
  };

  // --- RAPORLAMA HESAPLAMALARI ---
  const getDailyStats = () => {
    const stats = {
      total: 0,
      cash: 0,
      card: 0,
      mealCard: 0,
      veresiye: 0,
      count: transactions.length
    };

    transactions.forEach(t => {
      stats.total += t.total;
      if (t.type === 'Nakit') stats.cash += t.total;
      if (t.type === 'Kredi Kartı') stats.card += t.total;
      if (t.type === 'Yemek Kartı') stats.mealCard += t.total;
      if (t.type === 'Veresiye') stats.veresiye += t.total;
    });

    return stats;
  };

  // --- LOGIN EKRANI ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-slate-800">Uzunoğlu Market</h1>
            <p className="text-slate-500">POS Otomasyon Sistemi</p>
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
          </div>
        </div>
      </div>
    );
  }

  // --- ANA UYGULAMA ---
  return (
    <div className="h-screen flex flex-col bg-slate-100 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="bg-slate-800 text-white px-4 py-2 flex justify-between items-center shadow-md shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-orange-500 p-2 rounded-lg">
            <ShoppingCart size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Uzunoğlu Market</h1>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="bg-slate-700 px-2 py-0.5 rounded text-white">{selectedBranch}</span>
              <span>v1.0.2 + AI</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Rapor Menüsü */}
          <div className="relative">
            <button 
              onClick={() => setShowReport(!showReport)}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
            >
              <BarChart3 size={18} />
              <span>Gün Sonu: {formatCurrency(getDailyStats().total)}</span>
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
                  <div className="pt-3 mt-2 border-t border-slate-100 flex justify-between font-bold text-lg">
                    <span>Ciro:</span>
                    <span>{formatCurrency(getDailyStats().total)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-l border-slate-600 pl-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{currentUser.name}</div>
              <div className="text-xs text-slate-400">{currentUser.role}</div>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-red-600/20 text-red-400 rounded-full transition-colors">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SOL PANEL: Sepet ve İşlemler */}
        <div className="w-full lg:w-7/12 flex flex-col border-r border-slate-200 bg-white">
          
          {/* Barkod Input */}
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <form onSubmit={handleBarcodeSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
              <input 
                ref={inputRef}
                type="text" 
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Barkod Okutun veya Ürün Arayın..." 
                className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-lg shadow-sm"
                autoFocus
              />
            </form>
          </div>

          {/* Sepet Listesi */}
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                <ShoppingCart size={64} />
                <p className="text-xl font-medium">Sepet Boş</p>
                <p className="text-sm">Ürün eklemek için barkod okutun.</p>
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
                    <tr key={index} className="border-b hover:bg-slate-50 transition-colors group">
                      <td className="p-3 font-medium">
                        <div>{item.name}</div>
                        <div className="text-xs text-slate-400">{item.barcode}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2 bg-white border rounded-lg w-fit px-1">
                          <button onClick={() => updateQuantity(item.barcode, -1)} className="p-1 hover:bg-slate-100 rounded"><Minus size={14}/></button>
                          <span className="w-6 text-center font-bold">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.barcode, 1)} className="p-1 hover:bg-slate-100 rounded"><Plus size={14}/></button>
                        </div>
                      </td>
                      <td className="p-3 text-slate-500">{formatCurrency(item.price)}</td>
                      <td className="p-3 font-bold">{formatCurrency(item.price * item.quantity)}</td>
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

          {/* Bekleyen Fişler Slotları */}
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

          {/* Alt Kontrol Paneli (Toplam ve AI Butonları) */}
          <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
            {/* AI Butonları */}
            <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
               <button 
                  onClick={generateRecipe}
                  disabled={cart.length === 0 || aiLoading}
                  className="flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200 transition-colors text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <ChefHat size={16} />}
                  ✨ Tarif Öner
                </button>
                
                <button 
                  onClick={generateProductSuggestion}
                  disabled={cart.length === 0 || aiLoading}
                  className="flex items-center gap-2 bg-teal-100 text-teal-700 px-3 py-2 rounded-lg hover:bg-teal-200 transition-colors text-sm font-bold disabled:opacity-50 whitespace-nowrap"
                >
                  {aiLoading ? <Loader2 className="animate-spin" size={16}/> : <Lightbulb size={16} />}
                  ✨ Ürün Tavsiyesi
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
                <div className="text-sm text-slate-500">Genel Toplam</div>
                <div className="text-4xl font-extrabold text-slate-800 tracking-tight">
                  {formatCurrency(calculateTotal())}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SAĞ PANEL: Hızlı Ürünler ve Ödeme */}
        <div className="w-full lg:w-5/12 bg-slate-50 flex flex-col h-full">
          
          {/* Hızlı Ürünler Grid */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Hızlı Ürünler</h2>
            <div className="grid grid-cols-3 gap-3">
              {QUICK_PRODUCTS.map((product) => (
                <button
                  key={product.barcode}
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
          </div>

          {/* Ödeme Paneli */}
          <div className="p-4 bg-white border-t border-slate-200 shadow-lg">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Ödeme Tipi</h2>
            <div className="grid grid-cols-2 gap-3 h-48">
              <button 
                onClick={() => completeSale('Nakit')}
                disabled={cart.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                <Banknote size={32} />
                <span className="text-xl font-bold">NAKİT</span>
              </button>
              
              <button 
                onClick={() => completeSale('Kredi Kartı')}
                disabled={cart.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                <CreditCard size={32} />
                <span className="text-xl font-bold">KART</span>
              </button>
              
              <button 
                onClick={() => completeSale('Yemek Kartı')}
                disabled={cart.length === 0}
                className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-orange-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                <Utensils size={24} />
                <span className="font-bold">YEMEK KARTI</span>
                <span className="text-xs opacity-80">Sodexo / Ticket</span>
              </button>
              
              <button 
                onClick={() => setShowVeresiyeModal(true)}
                disabled={cart.length === 0}
                className="bg-red-500 hover:bg-red-600 text-white rounded-xl flex flex-col items-center justify-center gap-2 shadow-lg shadow-red-200 transition-all disabled:opacity-50 disabled:shadow-none active:scale-95"
              >
                <BookOpen size={24} />
                <span className="font-bold">VERESİYE</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Veresiye Modalı */}
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
                className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                İşlemi Tamamla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Sonuç Modalı */}
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