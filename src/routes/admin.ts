import { Router, Request, Response } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requirePlatformAdmin } from "../middleware/adminAuth.js";
import { okResponse, errResponse, idParamSchema } from "../schemas/common.js";

const router = Router();

// ── Helpers ──

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ════════════════════════════════════════
// AUTH (no middleware — public)
// ════════════════════════════════════════

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /api/admin/login
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin || admin.passwordHash !== hashPassword(password)) {
      res.status(401).json(errResponse("UNAUTHORIZED", "Неверный email или пароль"));
      return;
    }

    const token = generateToken();
    await prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { sessionToken: hashToken(token) },
    });

    res.cookie("admin-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.json(okResponse({ id: admin.id, email: admin.email, name: admin.name, token }));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("Admin login error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// POST /api/admin/logout
router.post("/logout", requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    await prisma.platformAdmin.update({
      where: { id: req.platformAdmin!.id },
      data: { sessionToken: null },
    });
    res.clearCookie("admin-token");
    res.json(okResponse({ loggedOut: true }));
  } catch (err) {
    console.error("Admin logout error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// GET /api/admin/me
router.get("/me", requirePlatformAdmin, async (req: Request, res: Response) => {
  res.json(okResponse(req.platformAdmin));
});

// ════════════════════════════════════════
// ALL routes below require platform admin
// ════════════════════════════════════════
router.use(requirePlatformAdmin);

// ── DASHBOARD STATS ──

// GET /api/admin/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [users, orgs, members, shifts, orders] = await Promise.all([
      prisma.user.count(),
      prisma.organization.count(),
      prisma.member.count(),
      prisma.shift.count(),
      prisma.order.count(),
    ]);
    res.json(okResponse({ users, orgs, members, shifts, orders }));
  } catch (err) {
    console.error("Admin stats error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── USERS ──

// GET /api/admin/users?skip=0&take=50&search=...
router.get("/users", async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 50));
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const where = search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ] }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, email: true, emailVerified: true,
          phone: true, createdAt: true, updatedAt: true,
          members: {
            select: {
              role: true, taktRole: true,
              organization: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json(okResponse({ users, total, skip, take }));
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// GET /api/admin/users/:id
router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: idParamSchema.parse(req.params).id },
      include: {
        members: {
          include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
        },
        sessions: { select: { id: true, createdAt: true, expiresAt: true } },
      },
    });
    if (!user) {
      res.status(404).json(errResponse("NOT_FOUND", "Пользователь не найден"));
      return;
    }
    res.json(okResponse(user));
  } catch (err) {
    console.error("Admin user detail error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  emailVerified: z.boolean().optional(),
});

// PATCH /api/admin/users/:id
router.patch("/users/:id", async (req: Request, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: idParamSchema.parse(req.params).id },
      data,
    });
    res.json(okResponse(user));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("Admin update user error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.account.deleteMany({ where: { userId: id } });
    await prisma.member.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("Admin delete user error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── ORGANIZATIONS ──

// GET /api/admin/orgs?skip=0&take=50&search=...
router.get("/orgs", async (req: Request, res: Response) => {
  try {
    const skip = Math.max(0, Number(req.query.skip) || 0);
    const take = Math.min(100, Math.max(1, Number(req.query.take) || 50));
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const where = search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
        ] }
      : {};

    const [orgs, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          members: {
            select: {
              id: true, role: true, taktRole: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { members: true, locations: true } },
        },
      }),
      prisma.organization.count({ where }),
    ]);

    res.json(okResponse({ orgs, total, skip, take }));
  } catch (err) {
    console.error("Admin orgs error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// GET /api/admin/orgs/:id
router.get("/orgs/:id", async (req: Request, res: Response) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: idParamSchema.parse(req.params).id },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, phone: true } } },
        },
        locations: true,
        _count: {
          select: { members: true, locations: true, shifts: true, orders: true },
        },
      },
    });
    if (!org) {
      res.status(404).json(errResponse("NOT_FOUND", "Организация не найдена"));
      return;
    }
    res.json(okResponse(org));
  } catch (err) {
    console.error("Admin org detail error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

const updateOrgSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  plan: z.enum(["TRIAL", "START", "NETWORK", "BLOCKED"]).optional(),
  trialEndsAt: z.string().datetime().optional().nullable(),
});

// PATCH /api/admin/orgs/:id
router.patch("/orgs/:id", async (req: Request, res: Response) => {
  try {
    const data = updateOrgSchema.parse(req.body);
    const org = await prisma.organization.update({
      where: { id: idParamSchema.parse(req.params).id },
      data: {
        ...data,
        trialEndsAt: data.trialEndsAt ? new Date(data.trialEndsAt) : data.trialEndsAt,
      },
    });
    res.json(okResponse(org));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("Admin update org error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/admin/orgs/:id
router.delete("/orgs/:id", async (req: Request, res: Response) => {
  try {
    const { id: orgId } = idParamSchema.parse(req.params);
    // Delete all org-related data
    await prisma.regulationLog.deleteMany({ where: { orgId } });
    await prisma.regulation.deleteMany({ where: { orgId } });
    await prisma.scheduleSlot.deleteMany({ where: { orgId } });
    await prisma.payRate.deleteMany({ where: { orgId } });
    await prisma.recipe.deleteMany({ where: { orgId } });
    await prisma.calendarTask.deleteMany({ where: { orgId } });
    await prisma.order.deleteMany({ where: { orgId } });
    await prisma.setting.deleteMany({ where: { orgId } });
    await prisma.checklistTemplate.deleteMany({ where: { orgId } });
    await prisma.shiftEvent.deleteMany({ where: { shift: { orgId } } });
    await prisma.shiftRating.deleteMany({ where: { shift: { orgId } } });
    await prisma.taskCompletion.deleteMany({ where: { shift: { orgId } } });
    await prisma.shift.deleteMany({ where: { orgId } });
    await prisma.product.deleteMany({ where: { orgId } });
    await prisma.alert.deleteMany({ where: { orgId } });
    await prisma.invitation.deleteMany({ where: { organizationId: orgId } });
    await prisma.member.deleteMany({ where: { organizationId: orgId } });
    await prisma.location.deleteMany({ where: { orgId } });
    await prisma.organization.delete({ where: { id: orgId } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("Admin delete org error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── MEMBERS ──

const addMemberSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
  role: z.enum(["owner", "admin", "member"]).default("member"),
  taktRole: z.enum(["OWNER", "OPS_DIRECTOR", "HEAD_BARISTA", "MANAGER", "BARISTA", "TRAINEE"]).default("BARISTA"),
});

// POST /api/admin/members
router.post("/members", async (req: Request, res: Response) => {
  try {
    const data = addMemberSchema.parse(req.body);
    const member = await prisma.member.create({
      data: {
        id: crypto.randomBytes(16).toString("hex"),
        userId: data.userId,
        organizationId: data.organizationId,
        role: data.role,
        taktRole: data.taktRole,
      },
    });
    res.status(201).json(okResponse(member));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json(errResponse("DUPLICATE", "Пользователь уже в организации"));
      return;
    }
    console.error("Admin add member error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

const updateMemberSchema = z.object({
  role: z.enum(["owner", "admin", "member"]).optional(),
  taktRole: z.enum(["OWNER", "OPS_DIRECTOR", "HEAD_BARISTA", "MANAGER", "BARISTA", "TRAINEE"]).optional(),
});

// PATCH /api/admin/members/:id
router.patch("/members/:id", async (req: Request, res: Response) => {
  try {
    const data = updateMemberSchema.parse(req.body);
    const member = await prisma.member.update({
      where: { id: idParamSchema.parse(req.params).id },
      data,
    });
    res.json(okResponse(member));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("Admin update member error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/admin/members/:id
router.delete("/members/:id", async (req: Request, res: Response) => {
  try {
    await prisma.member.delete({ where: { id: idParamSchema.parse(req.params).id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("Admin delete member error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── SESSIONS ──

// GET /api/admin/sessions — active sessions
router.get("/sessions", async (req: Request, res: Response) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(okResponse(sessions));
  } catch (err) {
    console.error("Admin sessions error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/admin/sessions/:id — terminate session
router.delete("/sessions/:id", async (req: Request, res: Response) => {
  try {
    await prisma.session.delete({ where: { id: idParamSchema.parse(req.params).id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("Admin delete session error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
