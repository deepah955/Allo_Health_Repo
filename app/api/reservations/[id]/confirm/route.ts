import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";

async function handleConfirm(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  
  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(reservation);
  }

  
  if (reservation.status === "RELEASED" || reservation.expiresAt < new Date()) {
    
    if (reservation.status === "PENDING") {
      await prisma.$transaction([
        prisma.$executeRaw`
          UPDATE "Stock"
          SET    "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0)
          WHERE  "productId"   = ${reservation.productId}
            AND  "warehouseId" = ${reservation.warehouseId}
        `,
        prisma.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        }),
      ]);
    }
    return NextResponse.json(
      { error: "Reservation has expired" },
      { status: 410 }
    );
  }

  
  const [, updated] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "Stock"
      SET    "total"    = GREATEST("total" - ${reservation.quantity}, 0),
             "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0)
      WHERE  "productId"   = ${reservation.productId}
        AND  "warehouseId" = ${reservation.warehouseId}
    `,
    prisma.reservation.update({
      where: { id },
      data: { status: "CONFIRMED" },
      include: { product: true, warehouse: true },
    }),
  ]);

  return NextResponse.json(updated);
}

export const POST = withIdempotency(handleConfirm as any);
