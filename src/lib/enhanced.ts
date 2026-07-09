import { enhance } from "@zenstackhq/runtime";
import { prisma } from "./prisma.js";

/**
 * Creates an enhanced PrismaClient with access policies enforced.
 * Pass the authenticated user context (from better-auth session).
 *
 * Usage:
 *   const db = getEnhancedDb({ id: session.user.id });
 *   const locations = await db.location.findMany(); // auto-filtered by org membership
 *
 * For unauthenticated access (e.g. signup flow), pass undefined:
 *   const db = getEnhancedDb(undefined);
 */
export function getEnhancedDb(user: { id: string } | undefined) {
  return enhance(prisma, { user: user ?? undefined });
}

/**
 * Raw PrismaClient without access policies.
 * Use ONLY for: migrations, seeds, platform admin, background jobs.
 */
export { prisma as rawDb };
