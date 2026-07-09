import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse, idParamSchema } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const createRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  group: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  photo: z.string().max(500).optional(),
  output: z.number().min(0).default(1),
  outputUnit: z.string().max(50).default("шт"),
  costPrice: z.number().min(0).optional(),
  steps: z.array(z.string()).optional(),
  ingredients: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    unit: z.string(),
  })).optional(),
});

const updateRecipeSchema = createRecipeSchema.partial().extend({
  isActive: z.boolean().optional(),
});

// GET /api/recipes — list all recipes
router.get("/", async (req, res) => {
  try {
    const recipes = await req.db.recipe.findMany({
      where: { orgId: req.orgId },
      orderBy: [{ group: "asc" }, { name: "asc" }],
    });
    res.json(okResponse(recipes));
  } catch (err) {
    console.error("GET /api/recipes error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// GET /api/recipes/:id — single recipe
router.get("/:id", async (req, res) => {
  try {
    const recipe = await req.db.recipe.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
    });
    if (!recipe) {
      res.status(404).json(errResponse("NOT_FOUND", "Техкарта не найдена"));
      return;
    }
    res.json(okResponse(recipe));
  } catch (err) {
    console.error("GET /api/recipes/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// POST /api/recipes — create recipe
router.post("/", async (req, res) => {
  try {
    const data = createRecipeSchema.parse(req.body);
    const recipe = await req.db.recipe.create({
      data: { ...data, orgId: req.orgId },
    });
    res.status(201).json(okResponse(recipe));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/recipes error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// PUT /api/recipes/:id — update recipe
router.put("/:id", async (req, res) => {
  try {
    const data = updateRecipeSchema.parse(req.body);
    const recipe = await req.db.recipe.update({
      where: { id: req.params.id },
      data,
    });
    res.json(okResponse(recipe));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PUT /api/recipes/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/recipes/:id
router.delete("/:id", async (req, res) => {
  try {
    await req.db.recipe.delete({ where: { id: req.params.id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/recipes/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
