import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.idempotencyRequest.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  // Create warehouses
  const [wh1, wh2, wh3] = await Promise.all([
    prisma.warehouse.create({
      data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
    }),
    prisma.warehouse.create({
      data: { name: "Delhi Hub", location: "New Delhi, NCR" },
    }),
    prisma.warehouse.create({
      data: { name: "Bangalore South", location: "Bengaluru, Karnataka" },
    }),
  ]);

  console.log(`✅ Created ${3} warehouses`);

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Earbuds Pro",
        description: "Premium noise-cancelling earbuds with 24h battery life",
        imageUrl: "https://placehold.co/400x300/1a1a2e/6366f1?text=Earbuds",
      },
    }),
    prisma.product.create({
      data: {
        name: "Smart Watch Ultra",
        description: "Health tracking smartwatch with AMOLED display",
        imageUrl: "https://placehold.co/400x300/1a1a2e/a855f7?text=Watch",
      },
    }),
    prisma.product.create({
      data: {
        name: "USB-C Power Bank",
        description: "20000mAh fast charging portable power bank",
        imageUrl: "https://placehold.co/400x300/1a1a2e/ec4899?text=PowerBank",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard",
        description: "RGB mechanical keyboard with hot-swappable switches",
        imageUrl: "https://placehold.co/400x300/1a1a2e/22c55e?text=Keyboard",
      },
    }),
    prisma.product.create({
      data: {
        name: "Laptop Stand",
        description: "Ergonomic aluminum laptop stand with adjustable height",
        imageUrl: "https://placehold.co/400x300/1a1a2e/f59e0b?text=Stand",
      },
    }),
    prisma.product.create({
      data: {
        name: "Webcam HD",
        description: "1080p HD webcam with auto-focus and noise reduction",
        imageUrl: "https://placehold.co/400x300/1a1a2e/06b6d4?text=Webcam",
      },
    }),
  ]);

  console.log(`✅ Created ${products.length} products`);

  // Create stock entries — varying quantities across warehouses
  const stockData = products.flatMap((p, i) => [
    { productId: p.id, warehouseId: wh1.id, total: 10 + i * 3, reserved: 0 },
    { productId: p.id, warehouseId: wh2.id, total: 5 + i * 2, reserved: 0 },
    { productId: p.id, warehouseId: wh3.id, total: 8 + i, reserved: 0 },
  ]);

  await prisma.stock.createMany({ data: stockData });

  console.log(`✅ Created ${stockData.length} stock entries`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
