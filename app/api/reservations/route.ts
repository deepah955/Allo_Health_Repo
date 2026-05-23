import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/cleanup";
import { withIdempotency } from "@/lib/idempotency";

const reserveSchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().int().min(1),
});

async function handleReserve(req: NextRequest): Promise<NextResponse> {
  const body = await req.json();
  const parsed = reserveSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { productId, warehouseId, quantity } = parsed.data;

  
  await releaseExpiredReservations();

  
  const affected = await prisma.$executeRaw`
    UPDATE "Stock"
    SET    "reserved" = "reserved" + ${quantity}
    WHERE  "productId"   = ${productId}
      AND  "warehouseId" = ${warehouseId}
      AND  ("total" - "reserved") >= ${quantity}
  `;

  if (affected === 0) {
    return NextResponse.json(
      { error: "Not enough stock available" },
      { status: 409 }
    );
  }

  
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); 
  const reservation = await prisma.reservation.create({
    data: { productId, warehouseId, quantity, expiresAt },
    include: { product: true, warehouse: true },
  });

  return NextResponse.json(reservation, { status: 201 });
}

export const POST = withIdempotency(handleReserve);

export async function GET() {
  const reservations = await prisma.reservation.findMany({
    include: { product: true, warehouse: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(reservations);
}
