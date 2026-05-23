import { prisma } from "./prisma";


export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });

  if (expired.length === 0) return 0;

  
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

  
  await prisma.reservation.updateMany({
    where: { id: { in: expired.map((r) => r.id) } },
    data: { status: "RELEASED" },
  });

  return expired.length;
}
