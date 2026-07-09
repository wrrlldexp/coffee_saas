import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional(),
  group: z.string().max(100).optional(),
  unit: z.string().default("шт"),
  costPrice: z.number().min(0).optional(),
});

/** GET /api/products */
router.get("/", async (req, res) => {
  try {
    const products = await req.db.product.findMany({
      where: { orgId: req.orgId },
      orderBy: { name: "asc" },
    });
    res.json(okResponse(products));
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/products */
router.post("/", async (req, res) => {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await req.db.product.create({
      data: { ...data, orgId: req.orgId },
    });
    res.status(201).json(okResponse(product));
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json(errResponse("DUPLICATE", "Продукт с таким SKU уже существует"));
      return;
    }
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/products error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** PATCH /api/products/:id */
router.patch("/:id", async (req, res) => {
  try {
    const data = createProductSchema.partial().extend({
      isActive: z.boolean().optional(),
    }).parse(req.body);

    const product = await req.db.product.update({
      where: { id: req.params.id },
      data,
    });
    res.json(okResponse(product));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PATCH /api/products/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** DELETE /api/products/:id */
router.delete("/:id", async (req, res) => {
  try {
    await req.db.product.delete({ where: { id: req.params.id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/products/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
