import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status === "RELEASED") {
    return NextResponse.json(reservation);
  }

  if (reservation.status === "CONFIRMED") {
    return NextResponse.json(
      { error: "Cannot release a confirmed reservation" },
      { status: 400 }
    );
  }

  const [, updated] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE "Stock"
      SET    "reserved" = GREATEST("reserved" - ${reservation.quantity}, 0)
      WHERE  "productId"   = ${reservation.productId}
        AND  "warehouseId" = ${reservation.warehouseId}
    `,
    prisma.reservation.update({
      where: { id },
      data: { status: "RELEASED" },
      include: { product: true, warehouse: true },
    }),
  ]);

  return NextResponse.json(updated);
}
