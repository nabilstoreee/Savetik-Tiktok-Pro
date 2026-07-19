import React, { useState, useEffect } from "react";
import { ShoppingBag, X } from "lucide-react";
import { getProducts, subscribeProducts, auth } from "../lib/firebase";

interface Product {
  id?: string;
  name: string;
  price: string;
  type?: string;
  waNumber?: string;
  waMessage?: string;
}

interface Props {
  onClose: () => void;
  isModal?: boolean;
}

export const ProductsView: React.FC<Props> = ({ onClose, isModal = true }) => {
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Fetch once to handle auto-seeding if completely empty
    getProducts().then(() => {
      setLoading(false);
    });

    // Subscribe to products in real-time
    const unsubscribe = subscribeProducts((data) => {
      setProductList(data);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const limitProducts = productList.filter((p) => p.type === "limit" || !p.type);
  const premiumProducts = productList.filter((p) => p.type === "premium");
  const premiumBonusProducts = productList.filter((p) => p.type === "premium_bonus");

  const buildWaUrl = (p: Product) => {
    const num = p.waNumber || "6282136034173";
    const user = auth.currentUser;
    const emailInfo = user && user.email ? ` (Email akun saya: ${user.email})` : "";
    const msg = p.waMessage 
      ? `${p.waMessage}${emailInfo}` 
      : `Halo Admin, saya ingin membeli ${p.name} seharga ${p.price}${emailInfo}`;
    return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
  };

  const content = (
      <div className="w-full max-w-lg bg-theme-panel border-4 border-theme-border shadow-[8px_8px_0px_var(--theme-shadow)] p-6 text-theme-text relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-theme-text hover:text-gray-400 cursor-pointer p-1">
            <X className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black mb-6 flex items-center gap-3 text-theme-text">
            <ShoppingBag className="w-7 h-7 text-theme-text" /> Beli Produk
        </h1>
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-none h-10 w-10 border-4 border-theme-border border-t-theme-primary mb-4"></div>
            <p className="font-mono font-bold text-sm text-theme-text">Memuat daftar produk...</p>
          </div>
        ) : (
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-1">
              {limitProducts.length > 0 && (
                <section>
                  <h2 className="text-lg font-black mb-3 border-b-2 border-theme-border pb-1 uppercase tracking-wider text-theme-text flex justify-between items-center">
                    <span>Batas Limit</span>
                    <span className="text-[10px] font-mono bg-theme-bg text-theme-text px-2 py-0.5 border border-theme-border uppercase font-bold">Limit Saja</span>
                  </h2>
                  <div className="grid gap-2">
                      {limitProducts.map((p, i) => (
                      <div key={p.id || i} className="flex justify-between items-center border-2 border-theme-border p-3 font-mono font-bold bg-theme-bg hover:bg-theme-panel/50 transition-colors text-theme-text">
                          <span className="text-xs font-black">{p.name}</span>
                          <div className="flex items-center gap-2">
                              <span className="bg-black text-white px-2 py-0.5 border-2 border-theme-border font-black text-xs">{p.price}</span>
                              <a 
                                href={buildWaUrl(p)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-theme-text text-theme-bg hover:bg-theme-text/80 px-3 py-1 text-[10px] uppercase font-black border-2 border-theme-border transition-all cursor-pointer text-center block"
                              >
                                  BELI
                              </a>
                          </div>
                      </div>
                      ))}
                  </div>
                </section>
              )}

              {premiumProducts.length > 0 && (
                <section>
                  <h2 className="text-lg font-black mb-3 border-b-2 border-theme-border pb-1 uppercase tracking-wider text-theme-text flex justify-between items-center">
                    <span>Premium Pro</span>
                    <span className="text-[10px] font-mono bg-theme-bg text-theme-text px-2 py-0.5 border border-theme-border uppercase font-bold">Premium Saja</span>
                  </h2>
                  <div className="grid gap-2">
                      {premiumProducts.map((p, i) => (
                      <div key={p.id || i} className="flex justify-between items-center border-2 border-theme-border p-3 font-mono font-bold bg-theme-bg hover:bg-theme-panel/50 transition-colors text-theme-text">
                          <span className="text-xs font-black">{p.name}</span>
                          <div className="flex items-center gap-2">
                              <span className="bg-black text-white px-2 py-0.5 border-2 border-theme-border font-black text-xs">{p.price}</span>
                              <a 
                                href={buildWaUrl(p)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-theme-text text-theme-bg hover:bg-theme-text/80 px-3 py-1 text-[10px] uppercase font-black border-2 border-theme-border transition-all cursor-pointer text-center block"
                              >
                                  BELI
                              </a>
                          </div>
                      </div>
                      ))}
                  </div>
                </section>
              )}

              {premiumBonusProducts.length > 0 && (
                <section>
                  <h2 className="text-lg font-black mb-3 border-b-2 border-theme-border pb-1 uppercase tracking-wider text-theme-text flex justify-between items-center">
                    <span>Premium + Bonus Limit</span>
                    <span className="text-[10px] font-mono bg-theme-bg text-theme-text px-2 py-0.5 border border-theme-border uppercase font-bold">Best Value</span>
                  </h2>
                  <div className="grid gap-2">
                      {premiumBonusProducts.map((p, i) => (
                      <div key={p.id || i} className="flex justify-between items-center border-2 border-theme-border p-3 font-mono font-bold bg-theme-bg hover:bg-theme-panel/50 transition-colors text-theme-text">
                          <span className="text-xs font-black">{p.name}</span>
                          <div className="flex items-center gap-2">
                              <span className="bg-black text-white px-2 py-0.5 border-2 border-theme-border font-black text-xs">{p.price}</span>
                              <a 
                                href={buildWaUrl(p)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-theme-text text-theme-bg hover:bg-theme-text/80 px-3 py-1 text-[10px] uppercase font-black border-2 border-theme-border transition-all cursor-pointer text-center block"
                              >
                                  BELI
                              </a>
                          </div>
                      </div>
                      ))}
                  </div>
                </section>
              )}

              {productList.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-theme-border font-mono text-theme-text">
                  Belum ada produk terdaftar.
                </div>
              )}
          </div>
        )}
      </div>
  );

  return isModal ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        {content}
    </div>
  ) : content;
};
