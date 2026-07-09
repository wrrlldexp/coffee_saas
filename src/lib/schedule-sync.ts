import { rawDb } from "./enhanced.js";
import crypto from "node:crypto";

const SPREADSHEET_ID = "17fEsfqanJiDWImGolQD3YoAv-jnHBTBIM80auYalA1M";
const GID = "1641401923"; // July 2026 tab
const ORG_ID = "org_takt24";
const LOCATION_ID = "cmrapz8hc0000tbypyl2ocnu0"; // Сокольники
const MONTH = "2026-07";
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

// Known locations in the spreadsheet
const LOCATION_HEADERS = [
  "Кисловский", "Таганская 21", "Сокольники", "Дельта",
  "Динамо", "Солнцево", "Таганская 9",
];

const SKIP_ROWS = ["Коментарий к смене", "Замена (Имя/Часы)"];

// Column index → day number mapping (0-based column indices, excluding col 0 = name)
// Week 1 (Jul 1-5, Wed-Sun): cols 1-10
// Week 2 (Jul 6-12, Mon-Sun): cols 12-25
// Week 3 (Jul 13-19): cols 27-40
// Week 4 (Jul 20-26): cols 42-55
// Week 5 (Jul 27-31): cols 57-66
const DAY_COLUMNS: Array<{ day: number; startCol: number }> = [];

function initDayColumns() {
  const weeks = [
    { firstDay: 1, count: 5, startCol: 1 },
    { firstDay: 6, count: 7, startCol: 12 },
    { firstDay: 13, count: 7, startCol: 27 },
    { firstDay: 20, count: 7, startCol: 42 },
    { firstDay: 27, count: 5, startCol: 57 },
  ];
  for (const w of weeks) {
    for (let i = 0; i < w.count; i++) {
      DAY_COLUMNS.push({ day: w.firstDay + i, startCol: w.startCol + i * 2 });
    }
  }
}
initDayColumns();

function deterministicId(name: string): string {
  return crypto.createHash("md5").update(name.trim().toLowerCase()).digest("hex").slice(0, 25);
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(current.trim());
        current = "";
        rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function normalizeTime(val: string): string | null {
  // Handle formats: "10:00", "10.00", "10::00", "7.30"
  const cleaned = val.replace(/::/g, ":").replace(/\./g, ":");
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

interface ScheduleEntry {
  userId: string;
  userName: string;
  location: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  note: string | null;
}

function parseScheduleRows(rows: string[][]): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];
  let currentLocation = "";

  for (const row of rows) {
    if (row.length < 2) continue;
    const name = row[0].trim();

    // Check if this is a location header (location name appears in BOTH col 0 and col 1)
    const col1 = (row[1] || "").trim();
    if (LOCATION_HEADERS.some((h) => (name === h && col1 === h) || (name === h && !col1))) {
      currentLocation = name;
      continue;
    }

    // Only sync Сокольники
    if (currentLocation !== "Сокольники") continue;

    // Skip кухня sections
    if (currentLocation.toLowerCase().includes("кухн")) continue;

    // Skip header/comment/empty rows
    if (!name || SKIP_ROWS.includes(name)) continue;
    if (name === MONTH || name.startsWith("Июль")) continue;

    // Check if this looks like an employee row (has time or ВЫХОДНОЙ in first data cells)
    let hasScheduleData = false;
    for (const dc of DAY_COLUMNS) {
      const val = (row[dc.startCol] || "").trim();
      if (val === "ВЫХОДНОЙ" || val === "отпуск" || normalizeTime(val)) {
        hasScheduleData = true;
        break;
      }
    }
    if (!hasScheduleData) continue;

    const userId = deterministicId(name);

    for (const dc of DAY_COLUMNS) {
      const startVal = (row[dc.startCol] || "").trim();
      const endVal = (row[dc.startCol + 1] || "").trim();

      if (!startVal) continue; // empty day

      const dayStr = String(dc.day).padStart(2, "0");
      const date = `${MONTH}-${dayStr}`;

      if (startVal === "ВЫХОДНОЙ") {
        entries.push({
          userId,
          userName: name,
          location: currentLocation,
          date,
          startTime: "00:00",
          endTime: "00:00",
          status: "day_off",
          note: null,
        });
      } else if (startVal === "отпуск" || startVal.toLowerCase() === "отпуск") {
        entries.push({
          userId,
          userName: name,
          location: currentLocation,
          date,
          startTime: "00:00",
          endTime: "00:00",
          status: "vacation",
          note: null,
        });
      } else if (LOCATION_HEADERS.some((h) => startVal.includes(h)) || startVal === "Дельта" || startVal === "Солнцево" || startVal === "арбат") {
        entries.push({
          userId,
          userName: name,
          location: currentLocation,
          date,
          startTime: "00:00",
          endTime: "00:00",
          status: "reassigned",
          note: startVal,
        });
      } else {
        const start = normalizeTime(startVal);
        const end = normalizeTime(endVal);
        if (start && end) {
          entries.push({
            userId,
            userName: name,
            location: currentLocation,
            date,
            startTime: start,
            endTime: end,
            status: "scheduled",
            note: null,
          });
        }
      }
    }
  }

  return entries;
}

async function fetchAndSync(): Promise<{ synced: number; errors: number }> {
  console.log(`[schedule-sync] Fetching spreadsheet...`);
  const res = await fetch(EXPORT_URL, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${res.status} ${res.statusText}`);
  }

  const csvText = await res.text();
  const rows = parseCSV(csvText);
  console.log(`[schedule-sync] Parsed ${rows.length} CSV rows`);

  const entries = parseScheduleRows(rows);
  console.log(`[schedule-sync] Found ${entries.length} schedule entries`);

  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      await rawDb.scheduleSlot.upsert({
        where: {
          orgId_userId_date: {
            orgId: ORG_ID,
            userId: entry.userId,
            date: entry.date,
          },
        },
        create: {
          orgId: ORG_ID,
          userId: entry.userId,
          userName: entry.userName,
          locationId: LOCATION_ID,
          date: entry.date,
          startTime: entry.startTime,
          endTime: entry.endTime,
          status: entry.status,
          note: entry.note,
        },
        update: {
          userName: entry.userName,
          startTime: entry.startTime,
          endTime: entry.endTime,
          status: entry.status,
          note: entry.note,
        },
      });
      synced++;
    } catch (err: any) {
      console.error(`[schedule-sync] Error upserting ${entry.userName} ${entry.date}:`, err.message);
      errors++;
    }
  }

  console.log(`[schedule-sync] Done: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

let syncTimer: ReturnType<typeof setInterval> | null = null;

export function startScheduleSync() {
  console.log(`[schedule-sync] Starting auto-sync every ${SYNC_INTERVAL_MS / 60000} minutes`);

  // Run immediately on start
  fetchAndSync().catch((err) => {
    console.error("[schedule-sync] Initial sync failed:", err.message);
  });

  // Then every 15 minutes
  syncTimer = setInterval(() => {
    fetchAndSync().catch((err) => {
      console.error("[schedule-sync] Sync failed:", err.message);
    });
  }, SYNC_INTERVAL_MS);
}

export function stopScheduleSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log("[schedule-sync] Stopped");
  }
}

export { fetchAndSync };
