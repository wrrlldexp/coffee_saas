import { Request, Response, NextFunction } from "express";
import { orgIdSchema } from "../schemas/common.js";

declare global {
  namespace Express {
    interface Request {
      /** Active organization ID from x-org-id header */
      orgId: string;
    }
  }
}

/**
 * Middleware: extracts x-org-id header.
 * Use after requireAuth on org-scoped routes.
 */
export function requireOrgContext(req: Request, res: Response, next: NextFunction) {
  const result = orgIdSchema.safeParse(req.headers["x-org-id"]);
  if (!result.success) {
    res.status(400).json({
      ok: false,
      error: { code: "MISSING_ORG", message: "Заголовок x-org-id обязателен" },
    });
    return;
  }
  req.orgId = result.data;
  next();
}
