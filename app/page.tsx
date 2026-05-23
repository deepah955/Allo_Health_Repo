"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* ───── Types ───── */
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

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
}

/* ───── Skeleton Card ───── */
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

/* ───── Toast Container ───── */
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

/* ───── Availability color helper ───── */
function availabilityColor(available: number): string {
  if (available <= 0) return "text-red-400";
  if (available <= 5) return "text-yellow-400";
  return "text-green-400";
}

/* ───── Main Page ───── */
export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reservingFor, setReservingFor] = useState<string | null>(null);

  // Per-product reservation form state
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

      // Initialize form state for new products
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

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold gradient-text mb-2">
          Products
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Browse inventory across all warehouses and reserve stock for fulfillment.
        </p>
      </div>

      {/* Grid */}
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
                {/* Product Info */}
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

                {/* Stock Table */}
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

                {/* Reserve Controls */}
                {product.stocks.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-end">
                    {/* Warehouse Selector */}
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

                    {/* Quantity */}
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

                    {/* Reserve Button */}
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
