import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse, idParamSchema } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const createLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  timezone: z.string().default("Europe/Moscow"),
  resetHour: z.number().int().min(0).max(23).default(10),
});

const updateLocationSchema = createLocationSchema.partial().extend({
  isActive: z.boolean().optional(),
  settings: z.any().optional(),
});

/** GET /api/locations — list org locations */
router.get("/", async (req, res) => {
  try {
    const locations = await req.db.location.findMany({
      where: { orgId: req.orgId },
      orderBy: { name: "asc" },
    });
    res.json(okResponse(locations));
  } catch (err) {
    console.error("GET /api/locations error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** GET /api/locations/:id */
router.get("/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const location = await req.db.location.findFirst({
      where: { id, orgId: req.orgId },
    });
    if (!location) {
      res.status(404).json(errResponse("NOT_FOUND", "Точка не найдена"));
      return;
    }
    res.json(okResponse(location));
  } catch (err) {
    console.error("GET /api/locations/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/locations */
router.post("/", async (req, res) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const location = await req.db.location.create({
      data: { ...data, orgId: req.orgId },
    });
    res.status(201).json(okResponse(location));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/locations error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** PATCH /api/locations/:id */
router.patch("/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateLocationSchema.parse(req.body);
    const location = await req.db.location.update({
      where: { id },
      data,
    });
    res.json(okResponse(location));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PATCH /api/locations/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** DELETE /api/locations/:id */
router.delete("/:id", async (req, res) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await req.db.location.delete({ where: { id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/locations/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
