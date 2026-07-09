import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { getEnhancedDb } from "../lib/enhanced.js";

// Extend Express Request with our types
declare global {
  namespace Express {
    interface Request {
      /** Authenticated user from better-auth session */
      authUser?: { id: string; name: string; email: string };
      /** Enhanced PrismaClient with access policies */
      db: ReturnType<typeof getEnhancedDb>;
    }
  }
}

/**
 * Middleware: resolves better-auth session and attaches enhanced DB client.
 * Routes behind this middleware get `req.authUser` and `req.db`.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session?.user) {
      res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: "Требуется авторизация" } });
      return;
    }

    req.authUser = {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    };
    req.db = getEnhancedDb({ id: session.user.id });
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    res.status(500).json({ ok: false, error: { code: "AUTH_ERROR", message: "Ошибка авторизации" } });
  }
}

/**
 * Optional auth — attaches user if session exists, otherwise anonymous enhanced client.
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user) {
      req.authUser = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
      };
      req.db = getEnhancedDb({ id: session.user.id });
    } else {
      req.db = getEnhancedDb(undefined);
    }
    next();
  } catch {
    req.db = getEnhancedDb(undefined);
    next();
  }
}
