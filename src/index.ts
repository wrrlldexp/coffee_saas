import "dotenv/config";
import express from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Routes
import meRouter from "./routes/me.js";
import locationsRouter from "./routes/locations.js";
import shiftsRouter from "./routes/shifts.js";
import checklistsRouter from "./routes/checklists.js";
import ordersRouter from "./routes/orders.js";
import calendarRouter from "./routes/calendar.js";
import productsRouter from "./routes/products.js";
import settingsRouter from "./routes/settings.js";
import demoRouter from "./routes/demo.js";
import dashboardRouter from "./routes/dashboard.js";
import recipesRouter from "./routes/recipes.js";
import scheduleRouter from "./routes/schedule.js";
import regulationsRouter from "./routes/regulations.js";
import adminRouter from "./routes/admin.js";
import { startScheduleSync, fetchAndSync } from "./lib/schedule-sync.js";

const app = express();
const PORT = Number(process.env.PORT) || 3010;

// ── Security headers ──
app.use(helmet({ contentSecurityPolicy: false }));

// ── CORS ──
app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
}));

// ── Rate limiting ──
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: { code: "RATE_LIMIT", message: "Слишком много запросов" } },
});
app.use("/api/", apiLimiter);

// Demo endpoint gets stricter limits
const demoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { ok: false, error: { code: "RATE_LIMIT", message: "Лимит создания демо-аккаунтов" } },
});
app.use("/api/demo/", demoLimiter);

// ── Compression (gzip) — before all other middleware ──
app.use(compression());

// ── better-auth handler (BEFORE express.json!) ──
app.all("/api/auth/*", toNodeHandler(auth));

// ── Middleware ──
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// ── Health check ──
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, version: "0.1.0" });
});

// ── API routes ──
app.use("/api/me", meRouter);
app.use("/api/locations", locationsRouter);
app.use("/api/shifts", shiftsRouter);
app.use("/api/checklists", checklistsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/products", productsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/demo", demoRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/schedule", scheduleRouter);
app.use("/api/regulations", regulationsRouter);
app.use("/api/admin", adminRouter);

// ── Manual schedule sync trigger ──
app.post("/api/schedule/sync", async (_req, res) => {
  try {
    const result = await fetchAndSync();
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Uploads (photo reports) ──
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// ── Static files ──
app.use(express.static(path.resolve(__dirname, "../public"), {
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ── Explicit index route (no-cache) ──
app.get("/", (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, "../public/index.html"));
});

// ── Onboarding route ──
app.get("/onboarding", (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, "../public/onboarding.html"));
});

// ── Admin backoffice ──
app.get("/admin", (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.resolve(__dirname, "../public/admin.html"));
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`🚀 takt-saas running on http://localhost:${PORT}`);
  console.log(`   Auth:     http://localhost:${PORT}/api/auth`);
  console.log(`   Health:   http://localhost:${PORT}/api/health`);
  console.log(`   API:      /api/{me,locations,shifts,checklists,orders,calendar,products,settings}`);

  // Start schedule sync from Google Sheets (every 15 min)
  startScheduleSync();
});

export default app;
