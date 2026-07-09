/**
 * Migration script: SQLite (hnn-app) → PostgreSQL (takt-saas)
 *
 * Usage:
 *   1. Copy takt.db from production server:
 *      scp root@185.198.58.90:/opt/hnn-closing/data/takt.db ./data-snapshot/takt.db
 *
 *   2. Run migration:
 *      npx tsx scripts/migrate-sqlite.ts [--org-slug=my-cafe] [--dry-run]
 *
 * What it does:
 *   - Reads all data from SQLite (networks, spots, users, shifts, etc.)
 *   - Creates organization(s), locations, users, members, shifts, completions, etc. in PostgreSQL
 *   - Maps old integer IDs to new cuid() IDs
 *   - Maps old roles to TaktRole enum
 *   - Creates better-auth accounts with password hashes
 *   - Preserves all historical data (events, ratings, orders, calendar tasks)
 */

import "dotenv/config";
import Database from "better-sqlite3";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";
import path from "node:path";

// ── Config ──
const SQLITE_PATH = process.env.SQLITE_PATH || path.resolve("data-snapshot/takt.db");
const DRY_RUN = process.argv.includes("--dry-run");
const ORG_SLUG_OVERRIDE = process.argv.find(a => a.startsWith("--org-slug="))?.split("=")[1];

// ── ID generation ──
function cuid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

// ── Role mapping ──
const ROLE_MAP: Record<string, { taktRole: string; authRole: string }> = {
  platform_director: { taktRole: "OWNER", authRole: "owner" },
  operations_director: { taktRole: "OPS_DIRECTOR", authRole: "admin" },
  territorial_manager: { taktRole: "MANAGER", authRole: "admin" },
  head_barista: { taktRole: "HEAD_BARISTA", authRole: "admin" },
  spot_manager: { taktRole: "MANAGER", authRole: "admin" },
  manager: { taktRole: "MANAGER", authRole: "admin" },
  admin: { taktRole: "MANAGER", authRole: "admin" },
  barista: { taktRole: "BARISTA", authRole: "member" },
  trainee: { taktRole: "TRAINEE", authRole: "member" },
};

// ── ID maps (old integer → new string) ──
const networkIdMap = new Map<number, string>();
const spotIdMap = new Map<number, string>();
const userIdMap = new Map<number, string>();
const shiftIdMap = new Map<number, string>();

async function main() {
  console.log("🔄 Migration: SQLite → PostgreSQL");
  console.log(`   Source: ${SQLITE_PATH}`);
  console.log(`   Dry run: ${DRY_RUN}`);
  console.log("");

  // Open SQLite
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  sqlite.pragma("journal_mode = WAL");

  // Open PostgreSQL
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── 1. Networks → Organizations ──
    console.log("📦 Migrating networks → organizations...");
    const networks = sqlite.prepare("SELECT * FROM networks").all() as any[];

    for (const net of networks) {
      const orgId = cuid();
      networkIdMap.set(net.id, orgId);

      const slug = ORG_SLUG_OVERRIDE && networks.length === 1
        ? ORG_SLUG_OVERRIDE
        : net.slug || `org-${net.id}`;

      if (!DRY_RUN) {
        await prisma.organization.create({
          data: {
            id: orgId,
            name: net.name,
            slug,
            metadata: net.settings || net.legal_entity || null,
            timezone: "Europe/Moscow",
            plan: "START",
            createdAt: net.created_at ? new Date(net.created_at) : new Date(),
            updatedAt: new Date(),
          },
        });
      }
      console.log(`   ✓ Network "${net.name}" → org ${orgId} (slug: ${slug})`);
    }

    // If no networks, create a default org
    if (networks.length === 0) {
      const orgId = cuid();
      networkIdMap.set(0, orgId);
      if (!DRY_RUN) {
        await prisma.organization.create({
          data: {
            id: orgId,
            name: "Imported Organization",
            slug: ORG_SLUG_OVERRIDE || "imported",
            plan: "START",
            updatedAt: new Date(),
          },
        });
      }
      console.log(`   ✓ Default org created: ${orgId}`);
    }

    // ── 2. Spots → Locations ──
    console.log("📍 Migrating spots → locations...");
    const spots = sqlite.prepare("SELECT * FROM spots").all() as any[];

    for (const spot of spots) {
      const locId = cuid();
      spotIdMap.set(spot.id, locId);
      const orgId = networkIdMap.get(spot.network_id) || networkIdMap.values().next().value!;

      if (!DRY_RUN) {
        await prisma.location.create({
          data: {
            id: locId,
            orgId,
            name: spot.name,
            timezone: spot.timezone || "Europe/Moscow",
            resetHour: spot.reset_hour ?? 10,
            isActive: spot.active !== 0,
            settings: spot.rates ? JSON.parse(spot.rates) : null,
            createdAt: spot.created_at ? new Date(spot.created_at) : new Date(),
            updatedAt: new Date(),
          },
        });
      }
      console.log(`   ✓ Spot "${spot.name}" → location ${locId}`);
    }

    // ── 3. Users → user + account + member ──
    console.log("👤 Migrating users...");
    const users = sqlite.prepare("SELECT * FROM users").all() as any[];

    for (const u of users) {
      const userId = cuid();
      userIdMap.set(u.id, userId);

      const roleInfo = ROLE_MAP[u.role] || ROLE_MAP.barista;
      const orgId = networkIdMap.get(u.network_id) || networkIdMap.values().next().value!;

      // Determine locationIds for member
      const locationIds: string[] = [];
      if (u.spot_id && spotIdMap.has(u.spot_id)) {
        locationIds.push(spotIdMap.get(u.spot_id)!);
      }

      const email = `${u.username}@imported.local`;

      if (!DRY_RUN) {
        // Create user
        await prisma.user.create({
          data: {
            id: userId,
            name: u.name,
            email,
            emailVerified: false,
            phone: u.phone || null,
            notificationPrefs: u.notification_prefs ? JSON.parse(u.notification_prefs) : null,
            uiPrefs: u.ui_prefs ? JSON.parse(u.ui_prefs) : null,
            createdAt: u.created_at ? new Date(u.created_at) : new Date(),
            updatedAt: new Date(),
          },
        });

        // Create account (with old password hash for credential login)
        await prisma.account.create({
          data: {
            id: cuid(),
            accountId: userId,
            providerId: "credential",
            userId,
            password: u.pass_hash || null,
            createdAt: u.created_at ? new Date(u.created_at) : new Date(),
            updatedAt: new Date(),
          },
        });

        // Create member
        await prisma.member.create({
          data: {
            id: cuid(),
            organizationId: orgId,
            userId,
            role: roleInfo.authRole,
            taktRole: roleInfo.taktRole as any,
            locationIds,
            createdAt: u.created_at ? new Date(u.created_at) : new Date(),
          },
        });
      }

      console.log(`   ✓ User "${u.name}" (${u.role}) → ${roleInfo.taktRole}/${roleInfo.authRole}`);
    }

    // ── 4. Shifts ──
    console.log("📋 Migrating shifts...");
    const shifts = sqlite.prepare("SELECT * FROM shifts").all() as any[];

    for (const s of shifts) {
      const shiftId = cuid();
      shiftIdMap.set(s.id, shiftId);
      const locId = spotIdMap.get(s.spot_id);
      if (!locId) continue;

      // Find orgId from location's spot
      const spot = spots.find(sp => sp.id === s.spot_id);
      const orgId = spot ? (networkIdMap.get(spot.network_id) || networkIdMap.values().next().value!) : networkIdMap.values().next().value!;

      if (!DRY_RUN) {
        await prisma.shift.create({
          data: {
            id: shiftId,
            orgId,
            locationId: locId,
            date: s.date,
            status: s.status === "closed" ? "CLOSED" : "OPEN",
            openedBy: s.opened_by || null,
            openedAt: s.opened_at ? new Date(s.opened_at) : null,
            closedBy: s.closed_by || null,
            closedAt: s.closed_at ? new Date(s.closed_at) : null,
            responsibleId: s.responsible_id ? (userIdMap.get(s.responsible_id) || null) : null,
            responsibleName: s.responsible_name || null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${shifts.length} shifts migrated`);

    // ── 5. Completions → TaskCompletion ──
    console.log("✅ Migrating completions...");
    const completions = sqlite.prepare("SELECT * FROM completions").all() as any[];
    let compCount = 0;

    for (const c of completions) {
      const shiftId = shiftIdMap.get(c.shift_id);
      if (!shiftId) continue;

      if (!DRY_RUN) {
        await prisma.taskCompletion.create({
          data: {
            id: cuid(),
            shiftId,
            taskKey: c.task_key,
            done: !!c.done,
            byUserId: c.by_user_id ? (userIdMap.get(c.by_user_id) || null) : null,
            byName: c.by_name || null,
            doneAt: c.at ? new Date(c.at) : null,
            photo: c.photo || null,
            listData: c.list_data ? JSON.parse(c.list_data) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
      compCount++;
    }
    console.log(`   ✓ ${compCount} completions migrated`);

    // ── 6. Events → ShiftEvent ──
    console.log("📝 Migrating events...");
    const events = sqlite.prepare("SELECT * FROM events").all() as any[];

    for (const e of events) {
      const shiftId = shiftIdMap.get(e.shift_id);
      if (!shiftId) continue;

      if (!DRY_RUN) {
        await prisma.shiftEvent.create({
          data: {
            id: cuid(),
            shiftId,
            taskKey: e.task_key || null,
            userId: e.user_id ? (userIdMap.get(e.user_id) || null) : null,
            userName: e.user_name || null,
            action: e.action,
            at: e.at ? new Date(e.at) : new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${events.length} events migrated`);

    // ── 7. Orders ──
    console.log("🛒 Migrating orders...");
    const orders = sqlite.prepare("SELECT * FROM orders").all() as any[];

    for (const o of orders) {
      const locId = spotIdMap.get(o.spot_id);
      if (!locId) continue;
      const spot = spots.find(sp => sp.id === o.spot_id);
      const orgId = spot ? (networkIdMap.get(spot.network_id) || networkIdMap.values().next().value!) : networkIdMap.values().next().value!;

      if (!DRY_RUN) {
        await prisma.order.create({
          data: {
            id: cuid(),
            orgId,
            locationId: locId,
            shiftId: o.shift_id ? (shiftIdMap.get(o.shift_id) || null) : null,
            shiftDate: o.shift_date || null,
            userId: o.user_id ? (userIdMap.get(o.user_id) || String(o.user_id)) : "unknown",
            userName: o.user_name || "Unknown",
            text: o.text,
            createdAt: o.created_at ? new Date(o.created_at) : new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${orders.length} orders migrated`);

    // ── 8. Ratings → ShiftRating ──
    console.log("⭐ Migrating ratings...");
    const ratings = sqlite.prepare("SELECT * FROM ratings").all() as any[];

    for (const r of ratings) {
      const shiftId = shiftIdMap.get(r.shift_id);
      if (!shiftId) continue;

      if (!DRY_RUN) {
        await prisma.shiftRating.create({
          data: {
            id: cuid(),
            shiftId,
            userId: r.user_id ? (userIdMap.get(r.user_id) || String(r.user_id)) : "unknown",
            userName: r.user_name || "Unknown",
            rating: r.rating,
            comment: r.comment || null,
            reviewPhoto: r.review_photo || null,
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${ratings.length} ratings migrated`);

    // ── 9. Cal tasks → CalendarTask ──
    console.log("📅 Migrating calendar tasks...");
    const calTasks = sqlite.prepare("SELECT * FROM cal_tasks").all() as any[];

    for (const t of calTasks) {
      const locId = spotIdMap.get(t.spot_id);
      if (!locId) continue;
      const spot = spots.find(sp => sp.id === t.spot_id);
      const orgId = spot ? (networkIdMap.get(spot.network_id) || networkIdMap.values().next().value!) : networkIdMap.values().next().value!;

      if (!DRY_RUN) {
        await prisma.calendarTask.create({
          data: {
            id: cuid(),
            orgId,
            locationId: locId,
            date: t.date,
            text: t.text,
            color: t.color || "default",
            done: !!t.done,
            assignedTo: t.assigned_to ? (userIdMap.get(t.assigned_to) || null) : null,
            assignedName: t.assigned_name || null,
            createdBy: t.created_by || null,
            repeat: t.repeat || null,
            repeatGroup: t.repeat_group ? String(t.repeat_group) : null,
            createdAt: t.created_at ? new Date(t.created_at) : new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${calTasks.length} calendar tasks migrated`);

    // ── 10. Notifications ──
    console.log("🔔 Migrating notifications...");
    const notifs = sqlite.prepare("SELECT * FROM notifications").all() as any[];

    for (const n of notifs) {
      const userId = userIdMap.get(n.user_id);
      if (!userId) continue;

      if (!DRY_RUN) {
        await prisma.notification.create({
          data: {
            id: cuid(),
            userId,
            type: n.type,
            message: n.message,
            data: n.data ? JSON.parse(n.data) : null,
            read: !!n.read,
            createdAt: n.created_at ? new Date(n.created_at) : new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${notifs.length} notifications migrated`);

    // ── 11. Push subscriptions ──
    console.log("📱 Migrating push subscriptions...");
    const pushSubs = sqlite.prepare("SELECT * FROM push_subs").all() as any[];

    for (const ps of pushSubs) {
      const userId = userIdMap.get(ps.user_id);
      if (!userId) continue;

      if (!DRY_RUN) {
        await prisma.pushSubscription.create({
          data: {
            id: cuid(),
            userId,
            sub: ps.sub ? JSON.parse(ps.sub) : {},
            createdAt: ps.created_at ? new Date(ps.created_at) : new Date(),
          },
        });
      }
    }
    console.log(`   ✓ ${pushSubs.length} push subscriptions migrated`);

    // ── 12. Test attempts ──
    console.log("🎓 Migrating test attempts...");
    const attempts = sqlite.prepare("SELECT * FROM attempts").all() as any[];

    for (const a of attempts) {
      const userId = userIdMap.get(a.user_id);
      if (!userId) continue;

      if (!DRY_RUN) {
        await prisma.testAttempt.create({
          data: {
            id: cuid(),
            userId,
            testKey: a.test_key,
            score: a.score,
            passed: a.passed ? true : false,
            answers: a.answers ? JSON.parse(a.answers) : null,
            questions: a._questions ? JSON.parse(a._questions) : null,
            startedAt: a.started_at ? new Date(a.started_at) : new Date(),
            finishedAt: a.finished_at ? new Date(a.finished_at) : null,
          },
        });
      }
    }
    console.log(`   ✓ ${attempts.length} test attempts migrated`);

    // ── 13. Audit log ──
    console.log("📜 Migrating audit log...");
    let auditCount = 0;
    try {
      const auditLogs = sqlite.prepare("SELECT * FROM audit_log").all() as any[];
      for (const a of auditLogs) {
        const orgId = a.network_id
          ? (networkIdMap.get(a.network_id) || networkIdMap.values().next().value!)
          : networkIdMap.values().next().value!;

        if (!DRY_RUN) {
          await prisma.auditLog.create({
            data: {
              id: cuid(),
              orgId,
              userId: a.user_id ? (userIdMap.get(a.user_id) || null) : null,
              userName: a.user_name || null,
              action: a.action,
              targetType: a.target_type || null,
              targetId: a.target_id ? String(a.target_id) : null,
              details: a.details ? JSON.parse(a.details) : null,
              createdAt: a.created_at ? new Date(a.created_at) : new Date(),
            },
          });
        }
        auditCount++;
      }
    } catch { /* table might not exist */ }
    console.log(`   ✓ ${auditCount} audit log entries migrated`);

    // ── 14. Alerts ──
    console.log("⚠️ Migrating alerts...");
    let alertCount = 0;
    try {
      const alerts = sqlite.prepare("SELECT * FROM alerts").all() as any[];
      for (const a of alerts) {
        const orgId = a.network_id
          ? (networkIdMap.get(a.network_id) || networkIdMap.values().next().value!)
          : networkIdMap.values().next().value!;

        if (!DRY_RUN) {
          await prisma.alert.create({
            data: {
              id: cuid(),
              orgId,
              locationId: a.spot_id ? (spotIdMap.get(a.spot_id) || null) : null,
              type: a.type,
              severity: a.severity || "warning",
              message: a.message,
              data: a.data ? JSON.parse(a.data) : null,
              resolved: !!a.resolved,
              resolvedAt: a.resolved_at ? new Date(a.resolved_at) : null,
              createdAt: a.created_at ? new Date(a.created_at) : new Date(),
            },
          });
        }
        alertCount++;
      }
    } catch { /* table might not exist */ }
    console.log(`   ✓ ${alertCount} alerts migrated`);

    // ── 15. Activity log ──
    console.log("📊 Migrating activity log...");
    let actCount = 0;
    try {
      const actLogs = sqlite.prepare("SELECT * FROM activity_log").all() as any[];
      for (const a of actLogs) {
        const userId = userIdMap.get(a.user_id);
        if (!userId) continue;

        if (!DRY_RUN) {
          await prisma.activityLog.create({
            data: {
              id: cuid(),
              userId,
              type: a.type,
              description: a.description || null,
              meta: a.meta ? JSON.parse(a.meta) : null,
              createdAt: a.created_at ? new Date(a.created_at) : new Date(),
            },
          });
        }
        actCount++;
      }
    } catch { /* table might not exist */ }
    console.log(`   ✓ ${actCount} activity log entries migrated`);

    // ── 16. Settings (key-value → per-org settings) ──
    console.log("⚙️ Migrating settings...");
    let settCount = 0;
    try {
      const settings = sqlite.prepare("SELECT * FROM settings").all() as any[];
      const defaultOrgId = networkIdMap.values().next().value!;

      for (const s of settings) {
        if (!DRY_RUN) {
          await prisma.setting.create({
            data: {
              id: cuid(),
              orgId: defaultOrgId,
              key: s.key,
              value: s.value ? JSON.parse(s.value) : null,
            },
          });
        }
        settCount++;
      }
    } catch { /* table might not exist */ }
    console.log(`   ✓ ${settCount} settings migrated`);

    // ── Summary ──
    console.log("\n" + "=".repeat(50));
    console.log("✅ Migration complete!");
    console.log(`   Organizations: ${networkIdMap.size}`);
    console.log(`   Locations:     ${spotIdMap.size}`);
    console.log(`   Users:         ${userIdMap.size}`);
    console.log(`   Shifts:        ${shiftIdMap.size}`);
    console.log(`   Completions:   ${compCount}`);
    console.log(`   Events:        ${events.length}`);
    console.log(`   Orders:        ${orders.length}`);
    console.log(`   Ratings:       ${ratings.length}`);
    console.log(`   Calendar:      ${calTasks.length}`);
    if (DRY_RUN) {
      console.log("\n⚠️  DRY RUN — nothing was written to PostgreSQL");
    }

    // ── Export ID mapping for reference ──
    const mapping = {
      networks: Object.fromEntries(networkIdMap),
      spots: Object.fromEntries(spotIdMap),
      users: Object.fromEntries(userIdMap),
      shifts: Object.fromEntries(shiftIdMap),
    };
    const fs = await import("node:fs");
    fs.writeFileSync(
      "data-snapshot/id-mapping.json",
      JSON.stringify(mapping, null, 2),
    );
    console.log("\n📄 ID mapping saved to data-snapshot/id-mapping.json");

  } finally {
    sqlite.close();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
