/**
 * Tenant isolation tests
 *
 * Verifies that ZenStack access policies properly isolate data between organizations.
 * Uses rawDb for setup, enhanced client for assertions.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { enhance } from "@zenstackhq/runtime";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const rawDb = new PrismaClient({ adapter });

// Test data IDs
const ORG_A_ID = "test-org-a-isolation";
const ORG_B_ID = "test-org-b-isolation";
const USER_A_ID = "test-user-a-isolation";
const USER_B_ID = "test-user-b-isolation";
const MEMBER_A_ID = "test-member-a-isolation";
const MEMBER_B_ID = "test-member-b-isolation";
const LOC_A_ID = "test-loc-a-isolation";
const LOC_B_ID = "test-loc-b-isolation";

function dbForUser(userId: string) {
  return enhance(rawDb, { user: { id: userId } });
}

function dbAnonymous() {
  return enhance(rawDb, { user: undefined });
}

beforeAll(async () => {
  // Clean up any leftover test data
  await rawDb.shiftEvent.deleteMany({ where: { shift: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } } });
  await rawDb.taskCompletion.deleteMany({ where: { shift: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } } });
  await rawDb.shiftRating.deleteMany({ where: { shift: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } } });
  await rawDb.order.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.shift.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.calendarTask.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.checklistTemplate.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.product.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.alert.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.auditLog.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.setting.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.location.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.member.deleteMany({ where: { organizationId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.notification.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.activityLog.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.pushSubscription.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.testAttempt.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.account.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.session.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.organization.deleteMany({ where: { id: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.user.deleteMany({ where: { id: { in: [USER_A_ID, USER_B_ID] } } });

  // Create two orgs
  await rawDb.organization.create({
    data: { id: ORG_A_ID, name: "Org A", slug: "test-org-a", updatedAt: new Date() },
  });
  await rawDb.organization.create({
    data: { id: ORG_B_ID, name: "Org B", slug: "test-org-b", updatedAt: new Date() },
  });

  // Create two users
  await rawDb.user.create({
    data: { id: USER_A_ID, name: "User A", email: "usera@isolation.test", updatedAt: new Date() },
  });
  await rawDb.user.create({
    data: { id: USER_B_ID, name: "User B", email: "userb@isolation.test", updatedAt: new Date() },
  });

  // User A is owner of Org A
  await rawDb.member.create({
    data: { id: MEMBER_A_ID, organizationId: ORG_A_ID, userId: USER_A_ID, role: "owner", taktRole: "OWNER" },
  });

  // User B is owner of Org B
  await rawDb.member.create({
    data: { id: MEMBER_B_ID, organizationId: ORG_B_ID, userId: USER_B_ID, role: "owner", taktRole: "OWNER" },
  });

  // Create locations
  await rawDb.location.create({
    data: { id: LOC_A_ID, orgId: ORG_A_ID, name: "Location A", updatedAt: new Date() },
  });
  await rawDb.location.create({
    data: { id: LOC_B_ID, orgId: ORG_B_ID, name: "Location B", updatedAt: new Date() },
  });

  // Create data in each org
  await rawDb.product.create({
    data: { orgId: ORG_A_ID, name: "Coffee A", unit: "шт", updatedAt: new Date() },
  });
  await rawDb.product.create({
    data: { orgId: ORG_B_ID, name: "Coffee B", unit: "шт", updatedAt: new Date() },
  });

  await rawDb.setting.create({
    data: { orgId: ORG_A_ID, key: "theme", value: { color: "red" } },
  });
  await rawDb.setting.create({
    data: { orgId: ORG_B_ID, key: "theme", value: { color: "blue" } },
  });

  await rawDb.shift.create({
    data: {
      orgId: ORG_A_ID, locationId: LOC_A_ID, date: "2026-01-01",
      status: "OPEN", updatedAt: new Date(),
    },
  });
  await rawDb.shift.create({
    data: {
      orgId: ORG_B_ID, locationId: LOC_B_ID, date: "2026-01-01",
      status: "OPEN", updatedAt: new Date(),
    },
  });
});

afterAll(async () => {
  // Clean up
  await rawDb.shiftEvent.deleteMany({ where: { shift: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } } });
  await rawDb.taskCompletion.deleteMany({ where: { shift: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } } });
  await rawDb.shiftRating.deleteMany({ where: { shift: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } } });
  await rawDb.order.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.shift.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.calendarTask.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.checklistTemplate.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.product.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.alert.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.auditLog.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.setting.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.location.deleteMany({ where: { orgId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.member.deleteMany({ where: { organizationId: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.notification.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.activityLog.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.pushSubscription.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.testAttempt.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.account.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.session.deleteMany({ where: { userId: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.organization.deleteMany({ where: { id: { in: [ORG_A_ID, ORG_B_ID] } } });
  await rawDb.user.deleteMany({ where: { id: { in: [USER_A_ID, USER_B_ID] } } });
  await rawDb.$disconnect();
});

// ─── Organization isolation ───

describe("Organization isolation", () => {
  it("User A can read Org A", async () => {
    const db = dbForUser(USER_A_ID);
    const org = await db.organization.findUnique({ where: { id: ORG_A_ID } });
    expect(org).not.toBeNull();
    expect(org!.name).toBe("Org A");
  });

  it("User A cannot read Org B", async () => {
    const db = dbForUser(USER_A_ID);
    const org = await db.organization.findUnique({ where: { id: ORG_B_ID } });
    expect(org).toBeNull();
  });

  it("User A sees only Org A in findMany", async () => {
    const db = dbForUser(USER_A_ID);
    const orgs = await db.organization.findMany({
      where: { id: { in: [ORG_A_ID, ORG_B_ID] } },
    });
    expect(orgs).toHaveLength(1);
    expect(orgs[0].id).toBe(ORG_A_ID);
  });
});

// ─── Location isolation ───

describe("Location isolation", () => {
  it("User A sees only Location A", async () => {
    const db = dbForUser(USER_A_ID);
    const locs = await db.location.findMany({
      where: { id: { in: [LOC_A_ID, LOC_B_ID] } },
    });
    expect(locs).toHaveLength(1);
    expect(locs[0].name).toBe("Location A");
  });

  it("User B sees only Location B", async () => {
    const db = dbForUser(USER_B_ID);
    const locs = await db.location.findMany({
      where: { id: { in: [LOC_A_ID, LOC_B_ID] } },
    });
    expect(locs).toHaveLength(1);
    expect(locs[0].name).toBe("Location B");
  });

  it("User A cannot read Location B directly", async () => {
    const db = dbForUser(USER_A_ID);
    const loc = await db.location.findUnique({ where: { id: LOC_B_ID } });
    expect(loc).toBeNull();
  });
});

// ─── Product isolation ───

describe("Product isolation", () => {
  it("User A sees only Org A products", async () => {
    const db = dbForUser(USER_A_ID);
    const products = await db.product.findMany();
    const names = products.map((p) => p.name);
    expect(names).toContain("Coffee A");
    expect(names).not.toContain("Coffee B");
  });

  it("User B sees only Org B products", async () => {
    const db = dbForUser(USER_B_ID);
    const products = await db.product.findMany();
    const names = products.map((p) => p.name);
    expect(names).toContain("Coffee B");
    expect(names).not.toContain("Coffee A");
  });
});

// ─── Shift isolation ───

describe("Shift isolation", () => {
  it("User A sees only Org A shifts", async () => {
    const db = dbForUser(USER_A_ID);
    const shifts = await db.shift.findMany();
    expect(shifts.every((s) => s.orgId === ORG_A_ID)).toBe(true);
  });

  it("User B sees only Org B shifts", async () => {
    const db = dbForUser(USER_B_ID);
    const shifts = await db.shift.findMany();
    expect(shifts.every((s) => s.orgId === ORG_B_ID)).toBe(true);
  });
});

// ─── Settings isolation ───

describe("Settings isolation", () => {
  it("User A sees only Org A settings", async () => {
    const db = dbForUser(USER_A_ID);
    const settings = await db.setting.findMany();
    expect(settings).toHaveLength(1);
    expect((settings[0].value as any).color).toBe("red");
  });

  it("User B sees only Org B settings", async () => {
    const db = dbForUser(USER_B_ID);
    const settings = await db.setting.findMany();
    expect(settings).toHaveLength(1);
    expect((settings[0].value as any).color).toBe("blue");
  });
});

// ─── Cross-tenant write protection ───

describe("Cross-tenant write protection", () => {
  it("User A cannot create location in Org B", async () => {
    const db = dbForUser(USER_A_ID);
    await expect(
      db.location.create({
        data: { orgId: ORG_B_ID, name: "Hacked Location", updatedAt: new Date() },
      })
    ).rejects.toThrow();
  });

  it("User A cannot update Location B", async () => {
    const db = dbForUser(USER_A_ID);
    await expect(
      db.location.update({
        where: { id: LOC_B_ID },
        data: { name: "Hacked" },
      })
    ).rejects.toThrow();
  });

  it("User A cannot delete Location B", async () => {
    const db = dbForUser(USER_A_ID);
    await expect(
      db.location.delete({ where: { id: LOC_B_ID } })
    ).rejects.toThrow();
  });
});

// ─── Anonymous access ───

describe("Anonymous access", () => {
  it("Anonymous user sees no organizations", async () => {
    const db = dbAnonymous();
    const orgs = await db.organization.findMany({
      where: { id: { in: [ORG_A_ID, ORG_B_ID] } },
    });
    expect(orgs).toHaveLength(0);
  });

  it("Anonymous user sees no locations", async () => {
    const db = dbAnonymous();
    const locs = await db.location.findMany();
    expect(locs).toHaveLength(0);
  });

  it("Anonymous user sees no products", async () => {
    const db = dbAnonymous();
    const products = await db.product.findMany();
    expect(products).toHaveLength(0);
  });
});

// ─── PlatformAdmin deny-all ───

describe("PlatformAdmin protection", () => {
  it("PlatformAdmin table is denied via enhanced client", async () => {
    const db = dbForUser(USER_A_ID);
    const admins = await db.platformAdmin.findMany();
    expect(admins).toHaveLength(0);
  });

  it("rawDb can access PlatformAdmin", async () => {
    const admins = await rawDb.platformAdmin.findMany();
    // May have seed data, but should not throw
    expect(Array.isArray(admins)).toBe(true);
  });
});

// ─── User self-access ───

describe("User self-access", () => {
  it("User A can read own profile", async () => {
    const db = dbForUser(USER_A_ID);
    const user = await db.user.findUnique({ where: { id: USER_A_ID } });
    expect(user).not.toBeNull();
    expect(user!.name).toBe("User A");
  });

  it("User A cannot read User B profile", async () => {
    const db = dbForUser(USER_A_ID);
    const user = await db.user.findUnique({ where: { id: USER_B_ID } });
    expect(user).toBeNull();
  });
});
