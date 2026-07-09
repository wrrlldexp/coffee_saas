import "dotenv/config";
import { auth } from "../src/lib/auth.js";
import { rawDb } from "../src/lib/enhanced.js";
import crypto from "node:crypto";

function cuid() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 25);
}

async function main() {
  const email = "magomed@takt24.ru";
  const password = "Takt2024Admin!";
  const name = "Магомед Куриев";

  console.log("Creating user...");
  const signup = await auth.api.signUpEmail({
    body: { name, email, password },
  });
  const userId = signup.user.id;
  console.log("User ID:", userId);

  console.log("Creating organization...");
  const orgId = cuid();
  await rawDb.organization.create({
    data: {
      id: orgId,
      name: "takt24",
      slug: "takt24",
      timezone: "Europe/Moscow",
      plan: "TRIAL",
      trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
  });

  console.log("Creating owner membership...");
  await rawDb.member.create({
    data: {
      id: cuid(),
      organizationId: orgId,
      userId,
      role: "owner",
      taktRole: "OWNER",
    },
  });

  console.log("=== DONE ===");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Org ID: ${orgId}`);
  console.log(`Role: owner (full access)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
