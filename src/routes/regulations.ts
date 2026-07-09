import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireOrgContext } from "../middleware/orgContext.js";
import { okResponse, errResponse, idParamSchema } from "../schemas/common.js";

const router = Router();
router.use(requireAuth, requireOrgContext);

// ── Photo upload setup ──
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads/regulations");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
      cb(new Error("Допустимы только изображения (JPEG, PNG, WebP, HEIC)"));
      return;
    }
    cb(null, true);
  },
});

// ── Cleanup photos older than 30 days (runs on startup & daily) ──
function cleanupOldPhotos() {
  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let deleted = 0;
    for (const f of files) {
      const fp = path.join(UPLOADS_DIR, f);
      const stat = fs.statSync(fp);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fp);
        deleted++;
      }
    }
    if (deleted > 0) console.log(`[regulations] Cleaned up ${deleted} photos older than 30 days`);
  } catch (e) { /* ignore */ }
}
cleanupOldPhotos();
setInterval(cleanupOldPhotos, 24 * 60 * 60 * 1000); // daily

// POST /api/regulations/upload-photo
router.post("/upload-photo", upload.single("photo"), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json(errResponse("NO_FILE", "Фото не загружено"));
    return;
  }
  const url = `/uploads/regulations/${req.file.filename}`;
  res.json(okResponse({ url }));
});

const createRegulationSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(["opening", "closing", "midday"]).default("opening"),
  locationId: z.string().optional(),
  sections: z.array(z.object({
    time: z.string().nullable().optional(),
    title: z.string().min(1),
    note: z.string().optional(),
    dayFilter: z.array(z.number().int().min(0).max(6)).optional(),
    tasks: z.array(z.object({
      name: z.string().min(1),
      note: z.string().optional(),
    })).min(1),
  })).min(1),
  isActive: z.boolean().default(true),
});

const updateRegulationSchema = createRegulationSchema.partial();

const logCompletionsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completions: z.record(z.object({
    done: z.boolean(),
    photo: z.string().optional(),
  })).default({}),
});

// GET /api/regulations — list all regulations
router.get("/", async (req: Request, res: Response) => {
  try {
    const regulations = await req.db.regulation.findMany({
      where: { orgId: req.orgId },
      orderBy: { name: "asc" },
    });
    res.json(okResponse(regulations));
  } catch (err) {
    console.error("GET /api/regulations error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// GET /api/regulations/:id — single regulation
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const reg = await req.db.regulation.findFirst({
      where: { id, orgId: req.orgId },
    });
    if (!reg) {
      res.status(404).json(errResponse("NOT_FOUND", "Регламент не найден"));
      return;
    }
    res.json(okResponse(reg));
  } catch (err) {
    console.error("GET /api/regulations/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// POST /api/regulations — create regulation
router.post("/", async (req: Request, res: Response) => {
  try {
    const data = createRegulationSchema.parse(req.body);
    const reg = await req.db.regulation.create({
      data: { ...data, orgId: req.orgId },
    });
    res.status(201).json(okResponse(reg));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/regulations error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// PUT /api/regulations/:id — update regulation
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateRegulationSchema.parse(req.body);
    const reg = await req.db.regulation.update({
      where: { id },
      data,
    });
    res.json(okResponse(reg));
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("PUT /api/regulations/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// DELETE /api/regulations/:id
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await req.db.regulation.delete({ where: { id } });
    res.json(okResponse({ deleted: true }));
  } catch (err) {
    console.error("DELETE /api/regulations/:id error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// ── Regulation Logs (журнал выполнения) ──

// GET /api/regulations/:id/log?date=2026-07-06
router.get("/:id/log", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const log = await req.db.regulationLog.findFirst({
      where: {
        regulationId: id,
        orgId: req.orgId,
        date,
        userId: req.authUser!.id,
      },
    });
    res.json(okResponse(log));
  } catch (err) {
    console.error("GET /api/regulations/:id/log error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

// POST /api/regulations/:id/log — save/update completions
router.post("/:id/log", async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { date, completions } = logCompletionsSchema.parse(req.body);
    const today = date || new Date().toISOString().slice(0, 10);

    const existing = await req.db.regulationLog.findFirst({
      where: {
        regulationId: id,
        date: today,
        userId: req.authUser!.id,
      },
    });

    // Check if all tasks are done (each value has .photo and .done)
    const allDone = Object.values(completions).length > 0 &&
      Object.values(completions).every((v) => v.done && v.photo);

    if (existing) {
      const log = await req.db.regulationLog.update({
        where: { id: existing.id },
        data: {
          completions,
          completedAt: allDone ? new Date() : null,
        },
      });
      res.json(okResponse(log));
    } else {
      const log = await req.db.regulationLog.create({
        data: {
          orgId: req.orgId,
          regulationId: id,
          date: today,
          userId: req.authUser!.id,
          userName: req.authUser!.name || "",
          completions,
          completedAt: allDone ? new Date() : null,
        },
      });
      res.json(okResponse(log));
    }
  } catch (err: any) {
    if (err.name === "ZodError") {
      res.status(400).json(errResponse("VALIDATION", err.message));
      return;
    }
    console.error("POST /api/regulations/:id/log error:", err);
    res.status(500).json(errResponse("INTERNAL", "Server error"));
  }
});

export default router;
