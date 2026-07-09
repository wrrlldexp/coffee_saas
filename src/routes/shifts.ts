import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD format required");

/** GET /api/shifts?locationId=&date= */
router.get("/", async (req, res) => {
  try {
    const where: any = { orgId: req.orgId };
    if (req.query.locationId) where.locationId = String(req.query.locationId);
    if (req.query.date) where.date = String(req.query.date);

    const shifts = await req.db.shift.findMany({
      where,
      include: {
        completions: true,
        location: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });
    res.json(okResponse(shifts));
  } catch (err) {
    console.error("GET /api/shifts error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** GET /api/shifts/:id */
router.get("/:id", async (req, res) => {
  try {
    const shift = await req.db.shift.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
      include: {
        completions: true,
        events: { orderBy: { at: "desc" } },
        ratings: true,
        location: { select: { id: true, name: true } },
      },
    });
    if (!shift) {
      res.status(404).json(errResponse("NOT_FOUND", "Смена не найдена"));
      return;
    }
    res.json(okResponse(shift));
  } catch (err) {
    console.error("GET /api/shifts/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/shifts — open a new shift */
router.post("/", async (req, res) => {
  try {
    const body = z.object({
      locationId: z.string().min(1),
      date: dateSchema,
    }).parse(req.body);

    const shift = await req.db.shift.create({
      data: {
        orgId: req.orgId,
        locationId: body.locationId,
        date: body.date,
        status: "OPEN",
        openedBy: req.authUser!.id,
        openedAt: new Date(),
        responsibleId: req.authUser!.id,
        responsibleName: req.authUser!.name,
      },
    });
    res.status(201).json(okResponse(shift));
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json(errResponse("DUPLICATE", "Смена на эту дату уже существует"));
      return;
    }
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/shifts error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** PATCH /api/shifts/:id/close — close shift */
router.patch("/:id/close", async (req, res) => {
  try {
    const shift = await req.db.shift.update({
      where: { id: req.params.id },
      data: {
        status: "CLOSED",
        closedBy: req.authUser!.id,
        closedAt: new Date(),
      },
    });
    res.json(okResponse(shift));
  } catch (err) {
    console.error("PATCH /api/shifts/:id/close error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/shifts/:id/completions — toggle task completion */
router.post("/:id/completions", async (req, res) => {
  try {
    const body = z.object({
      taskKey: z.string().min(1),
      done: z.boolean(),
      photo: z.string().optional(),
      listData: z.any().optional(),
    }).parse(req.body);

    const completion = await req.db.taskCompletion.upsert({
      where: {
        shiftId_taskKey: { shiftId: req.params.id, taskKey: body.taskKey },
      },
      create: {
        shiftId: req.params.id,
        taskKey: body.taskKey,
        done: body.done,
        byUserId: req.authUser!.id,
        byName: req.authUser!.name,
        doneAt: body.done ? new Date() : null,
        photo: body.photo,
        listData: body.listData,
      },
      update: {
        done: body.done,
        byUserId: req.authUser!.id,
        byName: req.authUser!.name,
        doneAt: body.done ? new Date() : null,
        photo: body.photo,
        listData: body.listData,
      },
    });
    res.json(okResponse(completion));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/shifts/:id/completions error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/shifts/:id/events — log shift event */
router.post("/:id/events", async (req, res) => {
  try {
    const body = z.object({
      taskKey: z.string().optional(),
      action: z.string().min(1),
    }).parse(req.body);

    const event = await req.db.shiftEvent.create({
      data: {
        shiftId: req.params.id,
        taskKey: body.taskKey,
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        action: body.action,
      },
    });
    res.json(okResponse(event));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/shifts/:id/events error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/shifts/:id/ratings */
router.post("/:id/ratings", async (req, res) => {
  try {
    const body = z.object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().optional(),
      reviewPhoto: z.string().optional(),
    }).parse(req.body);

    const rating = await req.db.shiftRating.create({
      data: {
        shiftId: req.params.id,
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        ...body,
      },
    });
    res.json(okResponse(rating));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/shifts/:id/ratings error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
