"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";


interface Stock {
  warehouseId: string;
  warehouseName: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  stocks: Stock[];
}

interface Warehouse {
  id: string;
  name: string;
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}


function SkeletonCard() {
  return (
    <div className="glass-card p-6 space-y-4">
      <div className="skeleton h-6 w-3/4 rounded-lg" />
      <div className="skeleton h-4 w-full rounded-lg" />
      <div className="skeleton h-4 w-5/6 rounded-lg" />
      <div className="space-y-2 mt-4">
        <div className="skeleton h-8 w-full rounded-lg" />
        <div className="skeleton h-8 w-full rounded-lg" />
        <div className="skeleton h-8 w-full rounded-lg" />
      </div>
      <div className="flex gap-3 mt-4">
        <div className="skeleton h-10 w-24 rounded-lg" />
        <div className="skeleton h-10 flex-1 rounded-lg" />
        <div className="skeleton h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}


function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed top-20 right-6 z-[1000] flex flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast ${t.type === "error" ? "toast-error" : "toast-success"} flex items-center gap-3`}
        >
          <span className="text-lg">{t.type === "error" ? "✕" : "✓"}</span>
          <span className="text-sm font-medium">{t.message}</span>
          <button
            onClick={() => onDismiss(t.id)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}


function availabilityColor(available: number): string {
  if (available <= 0) return "text-red-400";
  if (available <= 5) return "text-yellow-400";
  return "text-green-400";
}


export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reservingFor, setReservingFor] = useState<string | null>(null);

  
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);
  const [newProduct, setNewProduct] = useState<{
    name: string;
    description: string;
    imageUrl: string;
    stocks: Record<string, number>;
  }>({
    name: "",
    description: "",
    imageUrl: "",
    stocks: {},
  });

  
  const [formState, setFormState] = useState<
    Record<string, { warehouseId: string; quantity: number }>
  >({});

  const addToast = useCallback((type: "success" | "error", message: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);

      
      setFormState((prev) => {
        const next = { ...prev };
        for (const p of data) {
          if (!next[p.id] && p.stocks.length > 0) {
            next[p.id] = { warehouseId: p.stocks[0].warehouseId, quantity: 1 };
          }
        }
        return next;
      });
    } catch {
      addToast("error", "Could not load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchProducts();
    fetch("/api/warehouses")
      .then((res) => res.json())
      .then((data) => {
        setWarehouses(data);
        if (data.length > 0) {
          const initialStocks: Record<string, number> = {};
          data.forEach((w: Warehouse) => {
            initialStocks[w.id] = 0;
          });
          setNewProduct((prev) => ({
            ...prev,
            stocks: initialStocks,
          }));
        }
      })
      .catch(() => {});
  }, [fetchProducts]);

  const handleReserve = async (productId: string) => {
    const form = formState[productId];
    if (!form) return;

    setReservingFor(productId);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          warehouseId: form.warehouseId,
          quantity: form.quantity,
        }),
      });

      if (res.status === 201) {
        const reservation = await res.json();
        addToast("success", "Reservation created successfully!");
        router.push(`/reservations/${reservation.id}`);
        return;
      }

      if (res.status === 409) {
        addToast("error", "Not enough stock available");
      } else {
        const body = await res.json().catch(() => null);
        addToast("error", body?.error || "Failed to create reservation");
      }

      await fetchProducts();
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setReservingFor(null);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingProduct(true);
    try {
      const stocksArray = Object.entries(newProduct.stocks).map(([warehouseId, initialStock]) => ({
        warehouseId,
        initialStock,
      }));

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name,
          description: newProduct.description,
          imageUrl: newProduct.imageUrl,
          stocks: stocksArray,
        }),
      });
      if (res.ok) {
        addToast("success", "Product added successfully!");
        setShowAddProduct(false);
        const resetStocks: Record<string, number> = {};
        warehouses.forEach((w) => {
          resetStocks[w.id] = 0;
        });
        setNewProduct({
          name: "",
          description: "",
          imageUrl: "",
          stocks: resetStocks,
        });
        await fetchProducts();
      } else {
        const body = await res.json().catch(() => null);
        addToast("error", body?.error || "Failed to add product");
      }
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setAddingProduct(false);
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {}
      <div className="mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-extrabold gradient-text mb-2">
            Products
          </h1>
          <p className="text-[var(--text-secondary)] text-sm">
            Browse inventory across all warehouses and reserve stock for fulfillment.
          </p>
        </div>
        <button
          onClick={() => setShowAddProduct(!showAddProduct)}
          className="btn-primary text-sm whitespace-nowrap"
        >
          {showAddProduct ? "Cancel" : "+ Add Product"}
        </button>
      </div>

      {}
      {showAddProduct && (
        <form onSubmit={handleAddProduct} className="glass-card p-6 mb-10 animate-fade-in-up space-y-4">
          <h2 className="text-xl font-bold mb-4">Add New Product</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Name</label>
              <input required value={newProduct.name} onChange={(e) => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none" placeholder="Product name" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Description</label>
              <input required value={newProduct.description} onChange={(e) => setNewProduct({...newProduct, description: e.target.value})} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none" placeholder="Short description" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Image URL (Optional)</label>
              <input type="url" value={newProduct.imageUrl} onChange={(e) => setNewProduct({...newProduct, imageUrl: e.target.value})} className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--accent)] outline-none" placeholder="https://..." />
            </div>
            <div className="sm:col-span-2 border-t border-[var(--border)] pt-4 mt-2">
              <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-3">
                Warehouse Stock Configuration (Specify initial stock per region)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {warehouses.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{w.name}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">Region/Location</p>
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block mb-1">Stock</label>
                      <input
                        type="number"
                        min="0"
                        value={newProduct.stocks[w.id] ?? 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setNewProduct((prev) => ({
                            ...prev,
                            stocks: {
                              ...prev.stocks,
                              [w.id]: val,
                            },
                          }));
                        }}
                        className="w-full bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm text-right focus:border-[var(--accent)] outline-none"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={addingProduct} className="btn-success text-sm px-6">
              {addingProduct ? "Adding..." : "Save Product"}
            </button>
          </div>
        </form>
      )}

      {}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">📦</p>
          <p className="text-lg font-semibold">No products found</p>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Check back later or add products via the API.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((product, idx) => {
            const form = formState[product.id] ?? {
              warehouseId: product.stocks[0]?.warehouseId ?? "",
              quantity: 1,
            };

            return (
              <div
                key={product.id}
                className="glass-card p-6 hover:bg-[var(--bg-card-hover)] transition-all duration-300 hover:border-[var(--accent)]/30 animate-fade-in-up group"
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {}
                <h2 className="text-lg font-bold mb-1 group-hover:text-[var(--accent-hover)] transition-colors">
                  {product.name}
                </h2>
                {product.description && (
                  <p className="text-xs text-[var(--text-secondary)] mb-1 line-clamp-2">
                    {product.description}
                  </p>
                )}
                {product.sku && (
                  <p className="text-[10px] font-mono text-[var(--text-secondary)] mb-4 opacity-60">
                    SKU: {product.sku}
                  </p>
                )}

                {}
                <div className="overflow-x-auto mb-5">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-[var(--text-secondary)] border-b border-[var(--border)]">
                        <th className="text-left py-2 font-medium">
                          Warehouse
                        </th>
                        <th className="text-right py-2 font-medium">Total</th>
                        <th className="text-right py-2 font-medium">
                          Reserved
                        </th>
                        <th className="text-right py-2 font-medium">
                          Available
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.stocks.map((s) => (
                        <tr
                          key={s.warehouseId}
                          className="border-b border-[var(--border)]/50"
                        >
                          <td className="py-2 font-medium">
                            {s.warehouseName}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {s.total}
                          </td>
                          <td className="py-2 text-right tabular-nums text-yellow-400">
                            {s.reserved}
                          </td>
                          <td
                            className={`py-2 text-right tabular-nums font-semibold ${availabilityColor(s.available)}`}
                          >
                            {s.available}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {}
                {product.stocks.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-end">
                    {}
                    <div className="flex-1 min-w-[120px]">
                      <label className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                        Warehouse
                      </label>
                      <select
                        value={form.warehouseId}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...form,
                              warehouseId: e.target.value,
                            },
                          }))
                        }
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      >
                        {product.stocks.map((s) => (
                          <option key={s.warehouseId} value={s.warehouseId}>
                            {s.warehouseName} ({s.available} avail)
                          </option>
                        ))}
                      </select>
                    </div>

                    {}
                    <div className="w-20">
                      <label className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                        Qty
                      </label>
                      <select
                        value={form.quantity}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            [product.id]: {
                              ...form,
                              quantity: Number(e.target.value),
                            },
                          }))
                        }
                        className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                      >
                        {Array.from({ length: 10 }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    {}
                    <button
                      onClick={() => handleReserve(product.id)}
                      disabled={reservingFor === product.id}
                      className="btn-primary text-xs px-5 py-2 whitespace-nowrap"
                    >
                      {reservingFor === product.id ? (
                        <span className="flex items-center gap-2">
                          <svg
                            className="animate-spin h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                            />
                          </svg>
                          Reserving…
                        </span>
                      ) : (
                        "Reserve"
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
