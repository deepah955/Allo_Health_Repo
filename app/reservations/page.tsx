"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

function SkeletonRow() {
  return (
    <div className="glass-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="skeleton h-5 w-40 rounded-lg" />
        <div className="skeleton h-5 w-20 rounded-full" />
      </div>
      <div className="skeleton h-4 w-56 rounded-lg" />
      <div className="flex gap-4">
        <div className="skeleton h-3 w-32 rounded-lg" />
        <div className="skeleton h-3 w-32 rounded-lg" />
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "PENDING"
      ? "badge-pending"
      : status === "CONFIRMED"
        ? "badge-confirmed"
        : "badge-released";
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/reservations");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setReservations(data);
      } catch {
        setError("Could not load reservations.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      {}
      <div className="mb-10">
        <h1 className="text-3xl sm:text-4xl font-extrabold gradient-text mb-2">
          Reservations
        </h1>
        <p className="text-[var(--text-secondary)] text-sm">
          Manage your inventory reservations. Click a pending reservation to
          confirm or release it.
        </p>
      </div>

      {}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">⚠️</p>
          <p className="text-lg font-semibold text-red-400">{error}</p>
        </div>
      ) : reservations.length === 0 ? (
        <div className="glass-card p-16 text-center">
          <p className="text-5xl mb-4">📋</p>
          <p className="text-lg font-semibold">No reservations yet</p>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Go to{" "}
            <Link href="/" className="text-[var(--accent)] hover:underline">
              Products
            </Link>{" "}
            to create your first reservation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reservations.map((r, idx) => {
            const isPending = r.status === "PENDING";
            const content = (
              <>
                {}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold">
                      {r.product?.name || `Product ${r.productId}`}
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)] font-mono">
                      #{r.id.slice(0, 8)}
                    </span>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                {}
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  <span className="font-medium text-[var(--text-primary)]">
                    {r.quantity}×
                  </span>{" "}
                  from{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {r.warehouse?.name || r.warehouseId}
                  </span>
                </p>

                {}
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--text-secondary)]">
                  <span>Created: {formatDate(r.createdAt)}</span>
                  <span>
                    {r.status === "PENDING" ? "Expires" : "Expired"}:{" "}
                    {formatDate(r.expiresAt)}
                  </span>
                </div>

                {}
                {isPending && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-[var(--accent)]">
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Click to manage reservation
                  </div>
                )}
              </>
            );

            const className = `glass-card p-5 block transition-all duration-300 animate-fade-in-up ${
              isPending
                ? "hover:bg-[var(--bg-card-hover)] hover:border-[var(--accent)]/30 cursor-pointer"
                : ""
            }`;

            if (isPending) {
              return (
                <Link
                  key={r.id}
                  href={`/reservations/${r.id}`}
                  className={className}
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {content}
                </Link>
              );
            }

            return (
              <div
                key={r.id}
                className={className}
                style={{ animationDelay: `${idx * 60}ms` }}
              >
                {content}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
