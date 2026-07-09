import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

/** GET /api/settings — all org settings */
router.get("/", async (req, res) => {
  try {
    const settings = await req.db.setting.findMany({
      where: { orgId: req.orgId },
    });
    const map = Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
    res.json(okResponse(map));
  } catch (err) {
    console.error("GET /api/settings error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** PUT /api/settings/:key — upsert a setting */
router.put("/:key", async (req, res) => {
  try {
    const key = z.string().min(1).max(100).parse(req.params.key);
    const { value } = z.object({ value: z.any() }).parse(req.body);

    const setting = await req.db.setting.upsert({
      where: { orgId_key: { orgId: req.orgId, key } },
      create: { orgId: req.orgId, key, value },
      update: { value },
    });
    res.json(okResponse(setting));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PUT /api/settings/:key error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
