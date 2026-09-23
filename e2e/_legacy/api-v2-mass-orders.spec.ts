import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

test.describe("B2B API Gateway add_multi Endpoint E2E", () => {
  let prisma: PrismaClient;
  const apiKey = "test_reseller_api_key_123456789";
  const hashedKey = crypto.createHash("sha256").update(apiKey).digest("hex");
  let user: any;
  let service1: any;
  let service2: any;

  test.beforeAll(async () => {
    prisma = new PrismaClient();

    // 1. Prepare Test User with API Key & Balance (100 RUB = 10000 cents)
    user = await prisma.user.create({
      data: {
        email: "reseller-e2e-tester@test.com",
        apiKeyHash: hashedKey,
        balance: 1000000, // 10000 RUB
        role: "USER"
      }
    });

    // 2. Prepare Test Services
    const network = await prisma.network.upsert({
      where: { slug: "e2e-api-net" },
      update: {},
      create: { name: "E2E API Net", slug: "e2e-api-net", sort: 9 }
    });

    const category = await prisma.category.create({
      data: { name: "E2E API Category", networkId: network.id, sort: 9 }
    });

    service1 = await prisma.service.create({
      data: {
        name: "E2E API Service 1",
        categoryId: category.id,
        rate: 5.0,
        markup: 3.0,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        pricePer1000Cents: 1350
      }
    });

    service2 = await prisma.service.create({
      data: {
        name: "E2E API Service 2",
        categoryId: category.id,
        rate: 8.0,
        markup: 3.0,
        minQty: 10,
        maxQty: 10000,
        isActive: true,
        pricePer1000Cents: 2160
      }
    });
  });

  test.afterAll(async () => {
    if (user) {
      await prisma.order.deleteMany({ where: { userId: user.id } });
      await prisma.ledgerEntry.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
    if (service1) {
      await prisma.service.deleteMany({ where: { id: { in: [service1.id, service2.id] } } });
    }
    await prisma.$disconnect();
  });

  test("Should fail if API key is invalid", async ({ request }) => {
    const response = await request.post("/api/v2", {
      form: {
        key: "invalid_key",
        action: "add_multi",
        orders: JSON.stringify([{ service: service1.numericId, link: "http://test.com", quantity: 100 }])
      }
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Incorrect request or API key");
  });

  test("Should place multiple orders successfully via JSON array", async ({ request }) => {
    const response = await request.post("/api/v2", {
      form: {
        key: apiKey,
        action: "add_multi",
        orders: JSON.stringify([
          { service: service1.numericId, link: "http://test1.com", quantity: 100 },
          { service: service2.numericId, link: "http://test2.com", quantity: 200 }
        ])
      }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty("order");
    expect(body[1]).toHaveProperty("order");
    
    const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(Number(freshUser?.balance)).toBeLessThan(1000000);
  });

  test("Should place multiple orders successfully via form-encoded indexed keys", async ({ request }) => {
    const response = await request.post("/api/v2", {
      form: {
        key: apiKey,
        action: "add_multi",
        "orders[0][service]": service1.numericId.toString(),
        "orders[0][link]": "http://test3.com",
        "orders[0][quantity]": "100",
        "orders[1][service]": service2.numericId.toString(),
        "orders[1][link]": "http://test4.com",
        "orders[1][quantity]": "200"
      }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty("order");
    expect(body[1]).toHaveProperty("order");
  });

  test("Should handle partial success / error segregation", async ({ request }) => {
    // Set user balance so they only have enough for service1 but not service2
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: 20000 } // 200 RUB (20000 cents)
    });

    const response = await request.post("/api/v2", {
      form: {
        key: apiKey,
        action: "add_multi",
        orders: JSON.stringify([
          { service: service1.numericId, link: "http://test5.com", quantity: 100 }, // Succeeds
          { service: service2.numericId, link: "http://test6.com", quantity: 200 }  // Fails
        ])
      }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toHaveProperty("order");
    expect(body[1]).toHaveProperty("error", "Not enough funds on balance");
  });

  test("Should fail if batch size exceeds 50", async ({ request }) => {
    const massiveOrders = Array.from({ length: 51 }, () => ({
      service: service1.numericId,
      link: "http://test.com",
      quantity: 10
    }));

    const response = await request.post("/api/v2", {
      form: {
        key: apiKey,
        action: "add_multi",
        orders: JSON.stringify(massiveOrders)
      }
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Batch size too large (max 50 orders)");
  });
});
