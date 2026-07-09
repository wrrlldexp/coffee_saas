import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse, idParamSchema } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const timeRegex = /^\d{2}:\d{2}$/;

const createSlotSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().default(""),
  locationId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(timeRegex),
  endTime: z.string().regex(timeRegex),
  breakMin: z.number().int().min(0).default(0),
  note: z.string().max(500).optional(),
});

const updateSlotSchema = z.object({
  startTime: z.string().regex(timeRegex).optional(),
  endTime: z.string().regex(timeRegex).optional(),
  breakMin: z.number().int().min(0).optional(),
  note: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  locationId: z.string().optional(),
});

const createPayRateSchema = z.object({
  userId: z.string().min(1),
  userName: z.string().default(""),
  type: z.enum(["hourly", "daily", "monthly"]).default("hourly"),
  rate: z.number().min(0),
  currency: z.string().max(10).default("RUB"),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ── Schedule Slots ──

// GET /api/schedule?from=2026-07-01&to=2026-07-31
router.get("/", async (req: Request, res: Response) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().slice(0, 10);
    const to = (req.query.to as string) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

    const slots = await req.db.scheduleSlot.findMany({
      where: { orgId: req.orgId, date: { gte: from, lte: to } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    res.json(okResponse(slots));
  } catch (err) {
    console.error("GET /api/schedule error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// POST /api/schedule — create slot
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = createSlotSchema.parse(req.body);
    const slot = await req.db.scheduleSlot.create({
      data: {
        ...data,
        orgId: req.orgId,
        createdBy: req.authUser!.id,
      },
    });
    res.status(201).json(okResponse(slot));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json(errResponse("DUPLICATE", "Слот на эту дату для этого сотрудника уже существует"));
      return;
    }
    console.error("POST /api/schedule error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// PUT /api/schedule/:id
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateSlotSchema.parse(req.body);
    const slot = await req.db.scheduleSlot.update({
      where: { id },
      data,
    });
    res.json(okResponse(slot));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PUT /api/schedule/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/schedule/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await req.db.scheduleSlot.delete({ where: { id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/schedule/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── Pay Rates ──

// GET /api/schedule/pay-rates
router.get("/pay-rates", async (req: Request, res: Response) => {
  try {
    const rates = await req.db.payRate.findMany({
      where: { orgId: req.orgId },
      orderBy: [{ userName: "asc" }, { validFrom: "desc" }],
    });
    res.json(okResponse(rates));
  } catch (err) {
    console.error("GET /api/schedule/pay-rates error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// POST /api/schedule/pay-rates
router.post("/pay-rates", async (req: Request, res: Response) => {
  try {
    const data = createPayRateSchema.parse(req.body);
    const pr = await req.db.payRate.create({
      data: { ...data, orgId: req.orgId },
    });
    res.status(201).json(okResponse(pr));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/schedule/pay-rates error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── Payroll (зарплата по полумесяцам) ──

// GET /api/schedule/payroll?month=2026-07
router.get("/payroll", async (req: Request, res: Response) => {
  try {
    const monthStr = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const from = `${monthStr}-01`;
    const mid = `${monthStr}-15`;
    const to = `${monthStr}-${lastDay}`;

    const [slots, rates, members] = await Promise.all([
      req.db.scheduleSlot.findMany({
        where: { orgId: req.orgId, date: { gte: from, lte: to } },
      }),
      req.db.payRate.findMany({
        where: { orgId: req.orgId, validFrom: { lte: to } },
        orderBy: { validFrom: "desc" },
      }),
      req.db.member.findMany({
        where: { organizationId: req.orgId },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    // Group slots by user
    const userSlots = new Map<string, typeof slots>();
    for (const s of slots) {
      if (!userSlots.has(s.userId)) userSlots.set(s.userId, []);
      userSlots.get(s.userId)!.push(s);
    }

    // Find rate for user
    function getRate(userId: string) {
      return rates.find((r) => r.userId === userId) || null;
    }

    // Calc hours from time strings
    function calcHours(start: string, end: string, breakMin: number) {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      let mins = (eh * 60 + em) - (sh * 60 + sm);
      if (mins < 0) mins += 24 * 60; // overnight
      return Math.max(0, (mins - breakMin) / 60);
    }

    const payroll = members.map((m) => {
      const mSlots = userSlots.get(m.user.id) || [];
      const rate = getRate(m.user.id);
      const hourlyRate = rate?.rate || 0;

      // First half: 1-15, second half: 16-end
      let hoursFirst = 0, hoursSecond = 0;
      let shiftsFirst = 0, shiftsSecond = 0;

      for (const s of mSlots) {
        const day = parseInt(s.date.slice(8, 10));
        const h = calcHours(s.startTime, s.endTime, s.breakMin);
        if (day <= 15) {
          hoursFirst += h;
          shiftsFirst++;
        } else {
          hoursSecond += h;
          shiftsSecond++;
        }
      }

      const earnFirst = Math.round(hoursFirst * hourlyRate);
      const earnSecond = Math.round(hoursSecond * hourlyRate);

      return {
        userId: m.user.id,
        userName: m.user.name,
        taktRole: m.taktRole,
        hourlyRate,
        currency: rate?.currency || "RUB",
        firstHalf: { hours: Math.round(hoursFirst * 10) / 10, shifts: shiftsFirst, earned: earnFirst },
        secondHalf: { hours: Math.round(hoursSecond * 10) / 10, shifts: shiftsSecond, earned: earnSecond },
        total: { hours: Math.round((hoursFirst + hoursSecond) * 10) / 10, shifts: shiftsFirst + shiftsSecond, earned: earnFirst + earnSecond },
      };
    }).filter((p) => p.total.shifts > 0 || p.hourlyRate > 0);

    res.json(okResponse({
      month: monthStr,
      lastDay,
      payroll,
      totals: {
        earnedFirst: payroll.reduce((s, p) => s + p.firstHalf.earned, 0),
        earnedSecond: payroll.reduce((s, p) => s + p.secondHalf.earned, 0),
        earnedTotal: payroll.reduce((s, p) => s + p.total.earned, 0),
      },
    }));
  } catch (err) {
    console.error("GET /api/schedule/payroll error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
