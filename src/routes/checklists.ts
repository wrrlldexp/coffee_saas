import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

const taskSchema = z.object({
  key: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(["checkbox", "photo", "list", "text"]),
});

const sectionSchema = z.object({
  name: z.string().min(1),
  tasks: z.array(taskSchema).min(1),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["opening", "closing", "custom"]).default("closing"),
  sections: z.array(sectionSchema).min(1),
  isDefault: z.boolean().default(false),
});

/** GET /api/checklists — list templates */
router.get("/", async (req, res) => {
  try {
    const templates = await req.db.checklistTemplate.findMany({
      where: { orgId: req.orgId },
      orderBy: { createdAt: "desc" },
    });
    res.json(okResponse(templates));
  } catch (err) {
    console.error("GET /api/checklists error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** GET /api/checklists/:id */
router.get("/:id", async (req, res) => {
  try {
    const template = await req.db.checklistTemplate.findFirst({
      where: { id: req.params.id, orgId: req.orgId },
    });
    if (!template) {
      res.status(404).json(errResponse("NOT_FOUND", "Шаблон не найден"));
      return;
    }
    res.json(okResponse(template));
  } catch (err) {
    console.error("GET /api/checklists/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** POST /api/checklists */
router.post("/", async (req, res) => {
  try {
    const data = createTemplateSchema.parse(req.body);
    const template = await req.db.checklistTemplate.create({
      data: { ...data, orgId: req.orgId },
    });
    res.status(201).json(okResponse(template));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/checklists error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** PATCH /api/checklists/:id */
router.patch("/:id", async (req, res) => {
  try {
    const data = createTemplateSchema.partial().parse(req.body);
    const template = await req.db.checklistTemplate.update({
      where: { id: req.params.id },
      data,
    });
    res.json(okResponse(template));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PATCH /api/checklists/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

/** DELETE /api/checklists/:id */
router.delete("/:id", async (req, res) => {
  try {
    await req.db.checklistTemplate.delete({ where: { id: req.params.id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/checklists/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
