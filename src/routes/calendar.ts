import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const createTaskSchema = z.object({
  locationId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  text: z.string().min(1).max(500),
  color: z.string().default("default"),
  assignedTo: z.string().optional(),
  assignedName: z.string().optional(),
  repeat: z.string().optional(),
  repeatGroup: z.string().optional(),
});

/** GET /api/calendar?locationId=&from=&to= */
router.get("/", async (req, res) => {
  try {
    const where: any = { orgId: req.orgId };
    if (req.query.locationId) where.locationId = String(req.query.locationId);
    if (req.query.from || req.query.to) {
      where.date = {};
      if (req.query.from) where.date.gte = String(req.query.from);
      if (req.query.to) where.date.lte = String(req.query.to);
    }

    const tasks = await req.db.calendarTask.findMany({
      where,
      orderBy: { date: "asc" },
    });
    res.json(okResponse(tasks));
  } catch (err) {
    console.error("GET /api/calendar error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/calendar */
router.post("/", async (req, res) => {
  try {
    const data = createTaskSchema.parse(req.body);
    const task = await req.db.calendarTask.create({
      data: {
        orgId: req.orgId,
        createdBy: req.authUser!.id,
        ...data,
      },
    });
    res.status(201).json(okResponse(task));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/calendar error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** PATCH /api/calendar/:id */
router.patch("/:id", async (req, res) => {
  try {
    const data = createTaskSchema.partial().extend({
      done: z.boolean().optional(),
    }).parse(req.body);

    const task = await req.db.calendarTask.update({
      where: { id: req.params.id },
      data,
    });
    res.json(okResponse(task));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PATCH /api/calendar/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** DELETE /api/calendar/:id */
router.delete("/:id", async (req, res) => {
  try {
    await req.db.calendarTask.delete({ where: { id: req.params.id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/calendar/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
