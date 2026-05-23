"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ───── Types ───── */
interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  createdAt: string;
  expiresAt: string;
  product?: { id: string; name: string; description: string };
  warehouse?: { id: string; name: string; location: string };
}

interface Toast {
  id: number;
  type: "success" | "error";
  message: string;
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

/* ───── Status Badge ───── */
function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "PENDING"
      ? "badge-pending"
      : status === "CONFIRMED"
        ? "badge-confirmed"
        : "badge-released";
  return <span className={`badge ${cls}`}>{status}</span>;
}

/* ───── Countdown Ring ───── */
function CountdownRing({
  secondsLeft,
  totalSeconds,
}: {
  secondsLeft: number;
  totalSeconds: number;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, secondsLeft / totalSeconds);
  const dashOffset = circumference * (1 - progress);

  const mins = Math.max(0, Math.floor(secondsLeft / 60));
  const secs = Math.max(0, Math.floor(secondsLeft % 60));

  // Color transitions: indigo → yellow → red
  let ringColor = "#6366f1";
  let glowColor = "rgba(99, 102, 241, 0.3)";
  if (secondsLeft < 60) {
    ringColor = "#ef4444";
    glowColor = "rgba(239, 68, 68, 0.4)";
  } else if (secondsLeft < 180) {
    ringColor = "#f59e0b";
    glowColor = "rgba(245, 158, 11, 0.3)";
  }

  const isUrgent = secondsLeft < 60 && secondsLeft > 0;

  return (
    <div className={`relative inline-flex items-center justify-center ${isUrgent ? "pulse-urgent" : ""}`}>
      <svg width="140" height="140" viewBox="0 0 120 120">
        {/* Background ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Progress ring */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 60 60)"
          className="countdown-ring"
          filter="url(#glow)"
          style={{ filter: `drop-shadow(0 0 8px ${glowColor})` }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-2xl font-bold tabular-nums"
          style={{ color: ringColor }}
        >
          {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
        </span>
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">
          remaining
        </span>
      </div>
    </div>
  );
}

/* ───── Main Page ───── */
export default function ReservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((type: "success" | "error", message: string) => {
    const tid = Date.now();
    setToasts((prev) => [...prev, { id: tid, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== tid)),
      4000
    );
  }, []);

  const dismissToast = useCallback((tid: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== tid));
  }, []);

  /* Fetch reservation */
  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch("/api/reservations");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: Reservation[] = await res.json();
      const found = data.find((r) => r.id === id);
      if (!found) throw new Error("Reservation not found");
      setReservation(found);

      // Calculate countdown
      const expiresAt = new Date(found.expiresAt).getTime();
      const createdAt = new Date(found.createdAt).getTime();
      const now = Date.now();
      const total = Math.max(1, Math.floor((expiresAt - createdAt) / 1000));
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

      setTotalSeconds(total);
      setSecondsLeft(remaining);
    } catch {
      addToast("error", "Could not load reservation.");
    } finally {
      setLoading(false);
    }
  }, [id, addToast]);

  useEffect(() => {
    fetchReservation();
  }, [fetchReservation]);

  /* Countdown timer */
  useEffect(() => {
    if (!reservation || reservation.status !== "PENDING") return;

    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Auto-release on expiry
          clearInterval(timerRef.current!);
          handleRelease(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id, reservation?.status]);

  /* Actions */
  const handleConfirm = async () => {
    setActing(true);
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, {
        method: "POST",
      });
      if (res.ok) {
        if (timerRef.current) clearInterval(timerRef.current);
        setReservation((prev) =>
          prev ? { ...prev, status: "CONFIRMED" } : prev
        );
        addToast("success", "Purchase confirmed! Your items are secured.");
      } else if (res.status === 410) {
        if (timerRef.current) clearInterval(timerRef.current);
        setReservation((prev) =>
          prev ? { ...prev, status: "RELEASED" } : prev
        );
        setSecondsLeft(0);
        addToast("error", "Reservation has expired");
      } else {
        const body = await res.json().catch(() => null);
        addToast("error", body?.error || "Failed to confirm reservation");
      }
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setActing(false);
    }
  };

  const handleRelease = async (autoExpired = false) => {
    setActing(true);
    try {
      const res = await fetch(`/api/reservations/${id}/release`, {
        method: "POST",
      });
      if (res.ok || res.status === 410) {
        if (timerRef.current) clearInterval(timerRef.current);
        setReservation((prev) =>
          prev ? { ...prev, status: "RELEASED" } : prev
        );
        setSecondsLeft(0);
        addToast(
          autoExpired ? "error" : "success",
          autoExpired
            ? "Reservation expired and was auto-released."
            : "Reservation cancelled successfully."
        );
      } else {
        const body = await res.json().catch(() => null);
        addToast("error", body?.error || "Failed to release reservation");
      }
    } catch {
      addToast("error", "Network error. Please try again.");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="glass-card p-8 space-y-6">
          <div className="skeleton h-8 w-64 rounded-lg" />
          <div className="skeleton h-4 w-48 rounded-lg" />
          <div className="flex justify-center">
            <div className="skeleton h-36 w-36 rounded-full" />
          </div>
          <div className="flex gap-4 justify-center">
            <div className="skeleton h-12 w-40 rounded-xl" />
            <div className="skeleton h-12 w-40 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="max-w-2xl mx-auto glass-card p-16 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <p className="text-lg font-semibold">Reservation not found</p>
        <Link
          href="/reservations"
          className="text-[var(--accent)] hover:underline text-sm mt-2 inline-block"
        >
          ← Back to reservations
        </Link>
      </div>
    );
  }

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Breadcrumb */}
      <div className="mb-6">
        <Link
          href="/reservations"
          className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          ← Back to Reservations
        </Link>
      </div>

      <div className="max-w-2xl mx-auto animate-fade-in-up">
        <div className="glass-card p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold gradient-text mb-1">
                Checkout
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-mono">
                Reservation #{reservation.id.slice(0, 8)}
              </p>
            </div>
            <StatusBadge status={reservation.status} />
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Product
              </p>
              <p className="text-sm font-semibold">
                {reservation.product?.name || reservation.productId}
              </p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Warehouse
              </p>
              <p className="text-sm font-semibold">
                {reservation.warehouse?.name || reservation.warehouseId}
              </p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Quantity
              </p>
              <p className="text-sm font-semibold">{reservation.quantity} units</p>
            </div>
            <div className="bg-[var(--bg-secondary)] rounded-xl p-4">
              <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1">
                Created
              </p>
              <p className="text-sm font-semibold">
                {new Date(reservation.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Countdown (PENDING only) */}
          {isPending && (
            <div className="text-center mb-8">
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mb-4">
                Time to complete purchase
              </p>
              <CountdownRing
                secondsLeft={secondsLeft}
                totalSeconds={totalSeconds}
              />
              {secondsLeft <= 0 && (
                <p className="text-sm text-red-400 mt-3 font-medium">
                  Reservation has expired
                </p>
              )}
            </div>
          )}

          {/* Confirmed State */}
          {isConfirmed && (
            <div className="text-center mb-8 py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border-2 border-green-500/30 mb-4">
                <svg
                  className="w-10 h-10 text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-green-400 mb-1">
                Purchase Confirmed!
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                Your items have been secured and are ready for fulfillment.
              </p>
            </div>
          )}

          {/* Released State */}
          {isReleased && (
            <div className="text-center mb-8 py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 mb-4">
                <svg
                  className="w-10 h-10 text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-red-400 mb-1">
                Reservation Released
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                This reservation has been cancelled. Stock has been returned to
                inventory.
              </p>
            </div>
          )}

          {/* Action Buttons (PENDING only) */}
          {isPending && secondsLeft > 0 && (
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleConfirm}
                disabled={acting}
                className="btn-success flex items-center gap-2 text-sm"
              >
                {acting ? (
                  <svg
                    className="animate-spin h-4 w-4"
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
                ) : (
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
                Confirm Purchase
              </button>
              <button
                onClick={() => handleRelease(false)}
                disabled={acting}
                className="btn-danger flex items-center gap-2 text-sm"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                Cancel
              </button>
            </div>
          )}

          {/* Back link for completed states */}
          {!isPending && (
            <div className="text-center">
              <button
                onClick={() => router.push("/")}
                className="btn-primary text-sm"
              >
                Browse Products
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
