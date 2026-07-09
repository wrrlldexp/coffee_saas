import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";

declare global {
  namespace Express {
    interface Request {
      platformAdmin?: { id: string; email: string; name: string };
    }
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Middleware: authenticates platform admin via Bearer token.
 * Token is stored as SHA-256 hash in PlatformAdmin.passwordHash field (reused as session token hash).
 */
export async function requirePlatformAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      // Try cookie-based auth
      const token = req.cookies?.["admin-token"];
      if (!token) {
        res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Admin token required" } });
        return;
      }
      const admin = await prisma.platformAdmin.findFirst({
        where: { sessionToken: hashToken(token) },
      });
      if (!admin) {
        res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid admin token" } });
        return;
      }
      req.platformAdmin = { id: admin.id, email: admin.email, name: admin.name };
      next();
      return;
    }

    const token = authHeader.slice(7);
    const admin = await prisma.platformAdmin.findFirst({
      where: { sessionToken: hashToken(token) },
    });

    if (!admin) {
      res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid admin token" } });
      return;
    }

    req.platformAdmin = { id: admin.id, email: admin.email, name: admin.name };
    next();
  } catch (err) {
    console.error("Admin auth error:", err);
    res.status(500).json({ ok: false, error: { code: "INTERNAL", message: "Server error" } });
  }
}
