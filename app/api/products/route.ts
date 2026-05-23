import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/cleanup";
import { z } from "zod";

export async function GET() {
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
  });

  const result = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    stocks: p.stocks.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  }));

  return NextResponse.json(result);
}

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().url().optional().or(z.literal("")),
  stocks: z.array(z.object({
    warehouseId: z.string().min(1),
    initialStock: z.number().int().min(0),
  })),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, description, imageUrl, stocks } = parsed.data;

  
  const warehouseIds = stocks.map((s) => s.warehouseId);
  const warehouses = await prisma.warehouse.findMany({
    where: { id: { in: warehouseIds } },
  });

  if (warehouses.length !== warehouseIds.length) {
    return NextResponse.json({ error: "One or more warehouses not found" }, { status: 404 });
  }

  const product = await prisma.product.create({
    data: {
      name,
      description,
      imageUrl: imageUrl || null,
      stocks: {
        create: stocks.map((s) => ({
          warehouseId: s.warehouseId,
          total: s.initialStock,
          reserved: 0,
        })),
      },
    },
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
  });

  
  const result = {
    id: product.id,
    name: product.name,
    description: product.description,
    imageUrl: product.imageUrl,
    stocks: product.stocks.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  };

  return NextResponse.json(result, { status: 201 });
}
