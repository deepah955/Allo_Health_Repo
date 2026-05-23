import { prisma } from "./prisma";

/**
 * Releases all PENDING reservations whose expiresAt is in the past.
 * Returns the number of reservations released.
 * Safe to call on every API request (lazy cleanup).
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find all expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  // Release each expired reservation atomically
  await prisma.$transaction(
    expired.map((r) =>
      prisma.$executeRaw`
        UPDATE "Stock"
        SET    "reserved" = GREATEST("reserved" - ${r.quantity}, 0)
        WHERE  "productId"   = ${r.productId}
          AND  "warehouseId" = ${r.warehouseId}
      `
    )
  );

  // Mark them all as RELEASED
  await prisma.reservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "RELEASED" },
  });

  return expired.length;
}
