import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function id() {
  return crypto.randomUUID();
}

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Platform admin
  const adminId = id();
  await prisma.platformAdmin.upsert({
    where: { email: "admin@takt.pro" },
    update: {},
    create: {
      id: adminId,
      email: "admin@takt.pro",
      passwordHash: "change-me", // will be set properly via auth
      name: "Системный Администратор",
    },
  });
  console.log("  ✓ Platform admin created");

  // 2. Demo organization
  const orgId = id();
  await prisma.organization.upsert({
    where: { slug: "demo-cafe" },
    update: {},
    create: {
      id: orgId,
      name: "Демо Кафе",
      slug: "demo-cafe",
      timezone: "Europe/Moscow",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 days
      metadata: JSON.stringify({ demo: true }),
    },
  });
  console.log("  ✓ Demo organization created");

  // 3. Demo user (owner)
  const userId = id();
  await prisma.user.upsert({
    where: { email: "owner@demo.cafe" },
    update: {},
    create: {
      id: userId,
      name: "Владелец Демо",
      email: "owner@demo.cafe",
      emailVerified: true,
    },
  });
  console.log("  ✓ Demo owner user created");

  // 4. Member (link user to org as owner)
  const memberId = id();
  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: orgId,
        userId: userId,
      },
    },
    update: {},
    create: {
      id: memberId,
      organizationId: orgId,
      userId: userId,
      role: "owner",
      taktRole: "OWNER",
    },
  });
  console.log("  ✓ Owner membership created");

  // 5. Demo location
  const locId = id();
  await prisma.location.upsert({
    where: { id: locId },
    update: {},
    create: {
      id: locId,
      orgId: orgId,
      name: "Центральная точка",
      address: "ул. Примерная, 1",
      timezone: "Europe/Moscow",
      resetHour: 10,
    },
  });
  console.log("  ✓ Demo location created");

  // 6. Default checklist template
  const templateId = id();
  await prisma.checklistTemplate.upsert({
    where: { id: templateId },
    update: {},
    create: {
      id: templateId,
      orgId: orgId,
      name: "Закрытие смены",
      type: "closing",
      isDefault: true,
      sections: [
        {
          name: "Уборка",
          tasks: [
            { key: "clean_bar", text: "Протереть барную стойку", type: "checkbox" },
            { key: "clean_floor", text: "Помыть пол", type: "checkbox" },
            { key: "clean_photo", text: "Фото чистой зоны", type: "photo" },
          ],
        },
        {
          name: "Оборудование",
          tasks: [
            { key: "eq_grinder", text: "Промыть кофемолку", type: "checkbox" },
            { key: "eq_machine", text: "Промыть кофемашину", type: "checkbox" },
          ],
        },
      ],
    },
  });
  console.log("  ✓ Default checklist template created");

  console.log("\n✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
