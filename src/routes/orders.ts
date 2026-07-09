import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const createOrderSchema = z.object({
  locationId: z.string().min(1),
  shiftId: z.string().optional(),
  shiftDate: z.string().optional(),
  text: z.string().min(1).max(2000),
});

/** GET /api/orders?locationId= */
router.get("/", async (req, res) => {
  try {
    const where: any = { orgId: req.orgId };
    if (req.query.locationId) where.locationId = String(req.query.locationId);

    const orders = await req.db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { location: { select: { id: true, name: true } } },
    });
    res.json(okResponse(orders));
  } catch (err) {
    console.error("GET /api/orders error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/orders */
router.post("/", async (req, res) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await req.db.order.create({
      data: {
        orgId: req.orgId,
        userId: req.authUser!.id,
        userName: req.authUser!.name,
        ...data,
      },
    });
    res.status(201).json(okResponse(order));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/orders error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
