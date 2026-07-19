import React, { useState, useEffect } from "react";
import { Trash2, Edit2, Plus, X, ShoppingBag, Check, RefreshCw } from "lucide-react";
import { getProducts, addProduct, deleteProduct, updateProduct, subscribeProducts } from "../lib/firebase";

interface Product {
  id?: string;
  name: string;
  price: string;
  type: string; // "limit" | "premium"
  waNumber: string;
  waMessage: string;
}

export const AdminProductsView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Custom delete confirmation state
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Form States
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("limit");
  const [waNumber, setWaNumber] = useState("6282136034173");
  const [waMessage, setWaMessage] = useState("");

  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    setLoading(true);
    // Fetch once initially to handle seeding if collection is completely empty
    getProducts().then(() => {
      setLoading(false);
    });

    // Real-time subscription to auto-sync additions, edits, and deletions
    const unsubscribe = subscribeProducts((data) => {
      setProducts(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Update default message dynamically if user hasn't typed a custom one yet or is changing name/price in add mode
  useEffect(() => {
    if (!editId && name && price) {
      setWaMessage(`Halo Admin, saya mau beli ${name} seharga ${price}`);
    }
  }, [name, price, editId]);

  const fetchProducts = async () => {
    setLoading(true);
    await getProducts();
    setLoading(false);
  };

  const showFeedback = (text: string, success: boolean) => {
    setMessage({ text, success });
    setTimeout(() => {
      setMessage(null);
    }, 4000);
  };

  const resetForm = () => {
    setEditId(null);
    setName("");
    setPrice("");
    setType("limit");
    setWaNumber("6282136034173");
    setWaMessage("");
  };

  const handleEdit = (p: Product) => {
    setEditId(p.id || null);
    setName(p.name);
    setPrice(p.price);
    setType(p.type || "limit");
    setWaNumber(p.waNumber || "6282136034173");
    setWaMessage(p.waMessage || "");
    
    // Scroll smoothly to form
    const element = document.getElementById("product-form-container");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price.trim() || !waNumber.trim()) {
      showFeedback("Mohon isi semua field wajib!", false);
      return;
    }

    setActionLoading(true);
    const payload: Omit<Product, "id"> = {
      name: name.trim(),
      price: price.trim(),
      type,
      waNumber: waNumber.trim(),
      waMessage: waMessage.trim() || `Halo Admin, saya mau beli ${name} seharga ${price}`
    };

    try {
      if (editId) {
        await updateProduct(editId, payload);
        showFeedback("Produk berhasil diperbarui!", true);
      } else {
        await addProduct(payload);
        showFeedback("Produk baru berhasil ditambahkan!", true);
      }
      resetForm();
      await fetchProducts();
    } catch (e) {
      showFeedback("Gagal menyimpan produk. Coba lagi.", false);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setActionLoading(true);
    try {
      await deleteProduct(deleteTargetId);
      showFeedback("Produk berhasil dihapus!", true);
      if (editId === deleteTargetId) {
        resetForm();
      }
      setDeleteTargetId(null);
      await fetchProducts();
    } catch (e) {
      showFeedback("Gagal menghapus produk.", false);
    } finally {
      setActionLoading(false);
    }
  };

  const limitProducts = products.filter((p) => p.type === "limit" || !p.type);
  const premiumProducts = products.filter((p) => p.type === "premium");
  const premiumBonusProducts = products.filter((p) => p.type === "premium_bonus");

  return (
    <div className="space-y-8 text-black">
      {/* Page Title & Status */}
      <div className="flex justify-between items-center bg-yellow-400 border-4 border-black p-4 shadow-[4px_4px_0px_#000000]">
        <h1 className="text-xl md:text-2xl font-black uppercase flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" /> Kelola Produk & WA Admin
        </h1>
        <button 
          onClick={fetchProducts} 
          disabled={loading}
          className="bg-black text-white p-2 border-2 border-black hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Feedback message banner */}
      {message && (
        <div className={`border-4 border-black p-4 font-bold font-mono shadow-[4px_4px_0px_#000000] flex items-center gap-2 transition-all duration-300 ${message.success ? "bg-green-400" : "bg-red-400"}`}>
          <Check className="w-5 h-5 flex-shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* Two Columns Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Form (Thick black frame, neo-brutalism design) */}
        <div id="product-form-container" className="lg:col-span-5 bg-white border-4 border-black p-6 shadow-[8px_8px_0px_#000000] relative">
          <div className="absolute top-2 right-2 bg-black text-white font-mono text-[10px] uppercase font-black px-2 py-0.5 border-2 border-black">
            {editId ? "Mode Edit" : "Mode Tambah"}
          </div>

          <h2 className="text-lg font-black uppercase mb-4 pb-2 border-b-2 border-black flex items-center gap-2">
            {editId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {editId ? "Edit Produk Ini" : "Tambah Produk Baru"}
          </h2>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Nama Paket <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Contoh: Batas Limit 10" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                className="w-full border-2 border-black p-2 font-mono font-bold focus:bg-yellow-50 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Harga Paket <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Contoh: Rp10.000" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
                className="w-full border-2 border-black p-2 font-mono font-bold focus:bg-yellow-50 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Tipe Paket <span className="text-red-500">*</span>
              </label>
              <select 
                value={type} 
                onChange={(e) => setType(e.target.value)}
                className="w-full border-2 border-black p-2 font-mono font-black focus:outline-none bg-white"
              >
                <option value="limit">Batas Limit</option>
                <option value="premium">Premium Pro Saja</option>
                <option value="premium_bonus">Premium + Bonus Limit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Nomor WA Admin <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                placeholder="Contoh: 6282136034173 (Gunakan kode negara)" 
                value={waNumber} 
                onChange={(e) => setWaNumber(e.target.value)} 
                className="w-full border-2 border-black p-2 font-mono font-bold focus:bg-yellow-50 focus:outline-none"
                required
              />
              <span className="text-[10px] text-gray-500 font-mono">Format nomor WA harus diawali kode negara (misal 62) tanpa tanda +</span>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider mb-1">
                Pesan Template WhatsApp
              </label>
              <textarea 
                rows={3}
                placeholder="Contoh: Halo Admin, saya ingin membeli paket ini..."
                value={waMessage} 
                onChange={(e) => setWaMessage(e.target.value)} 
                className="w-full border-2 border-black p-2 font-mono font-bold focus:bg-yellow-50 focus:outline-none text-xs"
              />
              <span className="text-[10px] text-gray-500 font-mono block mt-1">Kosongkan untuk menggunakan template pesan otomatis berdasarkan nama paket</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="submit" 
                disabled={actionLoading}
                className="flex-grow bg-black text-white hover:bg-yellow-400 hover:text-black border-2 border-black font-black uppercase text-xs p-3 transition-all flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000000] cursor-pointer"
              >
                {actionLoading ? "Menyimpan..." : editId ? "SIMPAN PERUBAHAN" : "TAMBAH PRODUK"}
              </button>
              {editId && (
                <button 
                  type="button" 
                  onClick={resetForm}
                  className="bg-red-400 hover:bg-red-500 border-2 border-black p-3 font-black text-xs transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                >
                  BATAL
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Column: Dynamic Products List */}
        <div className="lg:col-span-7 space-y-6">
          {loading ? (
            <div className="bg-white border-4 border-black p-12 shadow-[8px_8px_0px_#000000] text-center">
              <div className="animate-spin rounded-none h-10 w-10 border-4 border-black border-t-yellow-400 mx-auto mb-4"></div>
              <p className="font-mono font-bold">Memuat daftar produk...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Limit Category */}
              <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_#000000]">
                <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 mb-4 flex items-center justify-between">
                  <span>List Batas Limit ({limitProducts.length})</span>
                  <span className="bg-yellow-300 px-2 py-0.5 border border-black font-mono text-xs">Category: limit</span>
                </h3>

                {limitProducts.length === 0 ? (
                  <p className="text-gray-500 text-sm font-mono text-center py-6">Belum ada paket Batas Limit.</p>
                ) : (
                  <div className="divide-y-2 divide-black">
                    {limitProducts.map((p) => (
                      <div key={p.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm">{p.name}</span>
                            <span className="bg-yellow-300 px-1.5 py-0.5 border border-black text-xs font-black">{p.price}</span>
                          </div>
                          <p className="text-[10px] text-gray-500">WA: +{p.waNumber || "6282136034173"}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-xs md:max-w-md">Msg: "{p.waMessage}"</p>
                        </div>

                        <div className="flex gap-2 self-end md:self-center">
                          <button 
                            onClick={() => handleEdit(p)}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-black font-black text-xs px-2.5 py-1.5 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                          >
                            EDIT
                          </button>
                          <button 
                            onClick={() => p.id && setDeleteTargetId(p.id)}
                            className="bg-red-400 hover:bg-red-500 text-black border-2 border-black font-black text-xs px-2.5 py-1.5 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                          >
                            HAPUS
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Premium Category */}
              <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_#000000]">
                <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 mb-4 flex items-center justify-between">
                  <span>List Premium Pro Saja ({premiumProducts.length})</span>
                  <span className="bg-purple-300 px-2 py-0.5 border border-black font-mono text-xs">Category: premium</span>
                </h3>

                {premiumProducts.length === 0 ? (
                  <p className="text-gray-500 text-sm font-mono text-center py-6">Belum ada paket Premium Saja.</p>
                ) : (
                  <div className="divide-y-2 divide-black">
                    {premiumProducts.map((p) => (
                      <div key={p.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm">{p.name}</span>
                            <span className="bg-yellow-300 px-1.5 py-0.5 border border-black text-xs font-black">{p.price}</span>
                          </div>
                          <p className="text-[10px] text-gray-500">WA: +{p.waNumber || "6282136034173"}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-xs md:max-w-md">Msg: "{p.waMessage}"</p>
                        </div>

                        <div className="flex gap-2 self-end md:self-center">
                          <button 
                            onClick={() => handleEdit(p)}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-black font-black text-xs px-2.5 py-1.5 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                          >
                            EDIT
                          </button>
                          <button 
                            onClick={() => p.id && setDeleteTargetId(p.id)}
                            className="bg-red-400 hover:bg-red-500 text-black border-2 border-black font-black text-xs px-2.5 py-1.5 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                          >
                            HAPUS
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Premium + Bonus Limit Category */}
              <div className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_#000000]">
                <h3 className="text-lg font-black uppercase border-b-2 border-black pb-2 mb-4 flex items-center justify-between">
                  <span>List Premium + Bonus Limit ({premiumBonusProducts.length})</span>
                  <span className="bg-green-300 px-2 py-0.5 border border-black font-mono text-xs">Category: premium_bonus</span>
                </h3>

                {premiumBonusProducts.length === 0 ? (
                  <p className="text-gray-500 text-sm font-mono text-center py-6">Belum ada paket Premium + Bonus Limit.</p>
                ) : (
                  <div className="divide-y-2 divide-black">
                    {premiumBonusProducts.map((p) => (
                      <div key={p.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm">{p.name}</span>
                            <span className="bg-yellow-300 px-1.5 py-0.5 border border-black text-xs font-black">{p.price}</span>
                          </div>
                          <p className="text-[10px] text-gray-500">WA: +{p.waNumber || "6282136034173"}</p>
                          <p className="text-[10px] text-gray-400 truncate max-w-xs md:max-w-md">Msg: "{p.waMessage}"</p>
                        </div>

                        <div className="flex gap-2 self-end md:self-center">
                          <button 
                            onClick={() => handleEdit(p)}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black border-2 border-black font-black text-xs px-2.5 py-1.5 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                          >
                            EDIT
                          </button>
                          <button 
                            onClick={() => p.id && setDeleteTargetId(p.id)}
                            className="bg-red-400 hover:bg-red-500 text-black border-2 border-black font-black text-xs px-2.5 py-1.5 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
                          >
                            HAPUS
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Custom Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-black p-6 max-w-md w-full shadow-[8px_8px_0px_#000000] text-black">
            <h3 className="text-lg font-black uppercase mb-2 text-red-600">Konfirmasi Hapus</h3>
            <p className="font-mono text-xs font-bold mb-6 text-gray-700">
              Apakah Anda yakin ingin menghapus produk ini? Tindakan ini permanen dan tidak dapat dibatalkan di database.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="bg-gray-200 hover:bg-gray-300 border-2 border-black font-black font-mono text-xs px-4 py-2 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
              >
                BATAL
              </button>
              <button
                onClick={confirmDelete}
                disabled={actionLoading}
                className="bg-red-500 hover:bg-red-600 text-white border-2 border-black font-black font-mono text-xs px-4 py-2 transition-all shadow-[2px_2px_0px_#000000] cursor-pointer"
              >
                {actionLoading ? "MENGHAPUS..." : "YA, HAPUS"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
