import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API_URL = "http://localhost:3000/api/reservations";

async function testConcurrency() {
  console.log("🧪 Starting Concurrency Test...");

  
  const testProduct = await prisma.product.create({
    data: {
      name: "Concurrency Test Item",
      description: "Temp item for concurrency testing",
    },
  });

  const testWarehouse = await prisma.warehouse.create({
    data: {
      name: "Concurrency Warehouse",
      location: "Virtual Space",
    },
  });

  
  await prisma.stock.create({
    data: {
      productId: testProduct.id,
      warehouseId: testWarehouse.id,
      total: 1,
      reserved: 0,
    },
  });

  console.log("✅ Seeded test item with total stock = 1");

  
  console.log("🚀 Blasting 10 concurrent reservation requests...");
  const requests = Array.from({ length: 10 }).map(async (_, idx) => {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          
          "idempotency-key": `test-concurrency-${idx}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: testProduct.id,
          warehouseId: testWarehouse.id,
          quantity: 1,
        }),
      });

      return {
        status: res.status,
        body: await res.json().catch(() => null),
      };
    } catch (err: any) {
      return { status: 0, error: err.message };
    }
  });

  const responses = await Promise.all(requests);

  
  const successes = responses.filter((r) => r.status === 201);
  const conflicts = responses.filter((r) => r.status === 409);
  const errors = responses.filter((r) => r.status !== 201 && r.status !== 409);

  console.log("\n📊 Test Results Summary:");
  console.log(`- Successes (201): ${successes.length}`);
  console.log(`- Conflicts (409): ${conflicts.length}`);
  console.log(`- Other Errors:    ${errors.length}`);

  if (errors.length > 0) {
    console.log("Detailed error list:", errors);
  }

  
  let success = true;
  if (successes.length !== 1) {
    console.error(`❌ FAILURE: Expected exactly 1 successful reservation, but got ${successes.length}`);
    success = false;
  }
  if (conflicts.length !== 9) {
    console.error(`❌ FAILURE: Expected exactly 9 conflict responses, but got ${conflicts.length}`);
    success = false;
  }

  if (success) {
    console.log("\n🎉 SUCCESS: Exactly 1 reservation succeeded and 9 failed with 409. Race-condition-free!");
  }

  
  console.log("\n🧹 Cleaning up test data...");
  await prisma.reservation.deleteMany({
    where: { productId: testProduct.id },
  });
  await prisma.stock.deleteMany({
    where: { productId: testProduct.id },
  });
  await prisma.product.delete({
    where: { id: testProduct.id },
  });
  await prisma.warehouse.delete({
    where: { id: testWarehouse.id },
  });
  console.log("✅ Cleanup done!");

  process.exit(success ? 0 : 1);
}

testConcurrency().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
