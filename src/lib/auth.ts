import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { prisma } from "./prisma.js";

// ============================================================
// Access control — maps to TaktRole permissions
// ============================================================

const statement = {
  // Org-level
  organization: ["update", "delete"],
  // Members
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "cancel"],
  // Domain entities
  location: ["create", "read", "update", "delete"],
  shift: ["create", "read", "update", "close"],
  checklist: ["read", "complete"],
  order: ["create", "read"],
  calendar: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  report: ["read"],
  settings: ["read", "update"],
} as const;

const ac = createAccessControl(statement);

// owner — full access
const ownerRole = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "read", "update", "delete"],
  invitation: ["create", "read", "cancel"],
  location: ["create", "read", "update", "delete"],
  shift: ["create", "read", "update", "close"],
  checklist: ["read", "complete"],
  order: ["create", "read"],
  calendar: ["create", "read", "update", "delete"],
  product: ["create", "read", "update", "delete"],
  report: ["read"],
  settings: ["read", "update"],
});

// admin — OPS_DIRECTOR, HEAD_BARISTA, MANAGER
const adminRole = ac.newRole({
  organization: ["update"],
  member: ["create", "read", "update"],
  invitation: ["create", "read", "cancel"],
  location: ["create", "read", "update"],
  shift: ["create", "read", "update", "close"],
  checklist: ["read", "complete"],
  order: ["create", "read"],
  calendar: ["create", "read", "update", "delete"],
  product: ["create", "read", "update"],
  report: ["read"],
  settings: ["read", "update"],
});

// member — BARISTA, TRAINEE
const memberRole = ac.newRole({
  member: ["read"],
  location: ["read"],
  shift: ["read", "update"],
  checklist: ["read", "complete"],
  order: ["create", "read"],
  calendar: ["read"],
  product: ["read"],
});

// ============================================================
// better-auth instance
// ============================================================

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,     // refresh every 24h
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 min cache
    },
  },

  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      telegramId: { type: "number", required: false },
      notificationPrefs: { type: "string", required: false },
      uiPrefs: { type: "string", required: false },
    },
  },

  plugins: [
    organization({
      ac,
      roles: {
        owner: ownerRole,
        admin: adminRole,
        member: memberRole,
      },
      allowUserToCreateOrganization: true,
      membershipLimit: 50,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      async sendInvitationEmail(data) {
        // TODO: Phase 4 — integrate with email/Telegram notifications
        console.log(`📨 Invitation for ${data.email}, org: ${data.organization.name}`);
      },
    }),
  ],
});

export { ac };
export type Auth = typeof auth;
