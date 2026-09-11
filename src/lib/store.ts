import type { EventRow, StoreSnapshot, TimeBand } from "../types";
import { DEFAULT_ORGS } from "../types";
const STORAGE_KEY = "pre-publish-week-list:v1";

export function uid(): string {
  return crypto.randomUUID();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function emptySnapshot(): StoreSnapshot {
  return {
    version: 1,
    events: [],
    orgs: [...DEFAULT_ORGS],
    updatedAt: new Date().toISOString(),
  };
}

export function loadStore(): StoreSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySnapshot();
    const parsed = JSON.parse(raw) as StoreSnapshot;
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) return emptySnapshot();
    return {
      version: 1,
      events: parsed.events,
      orgs: parsed.orgs?.length ? parsed.orgs : [...DEFAULT_ORGS],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptySnapshot();
  }
}

export function saveStore(snapshot: StoreSnapshot): void {
  const next = { ...snapshot, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function createEvent(input: {
  title: string;
  date: string;
  timeBand: TimeBand;
  org: string;
  postedBy?: string;
  notes?: string;
  checkedBeforePublish?: boolean;
}): EventRow {
  const now = new Date().toISOString();
  return {
    id: uid(),
    title: input.title.trim(),
    date: input.date,
    timeBand: input.timeBand,
    org: input.org.trim(),
    postedBy: (input.postedBy ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    checkedBeforePublish: Boolean(input.checkedBeforePublish),
    createdAt: now,
    updatedAt: now,
  };
}

export function startOfWeek(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function formatShortDate(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function clashKey(date: string, timeBand: TimeBand): string {
  return `${date}|${timeBand}`;
}

/** Same date + same time band = clash group (2+ events). */
export function clashGroups(events: EventRow[]): Map<string, EventRow[]> {
  const map = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = clashKey(e.date, e.timeBand);
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  for (const [key, list] of [...map.entries()]) {
    if (list.length < 2) map.delete(key);
  }
  return map;
}

export function isClashing(event: EventRow, events: EventRow[]): boolean {
  return events.some(
    (other) =>
      other.id !== event.id &&
      other.date === event.date &&
      other.timeBand === event.timeBand,
  );
}

export function eventsToCsv(events: EventRow[]): string {
  const header = [
    "title",
    "date",
    "timeBand",
    "org",
    "postedBy",
    "notes",
    "checkedBeforePublish",
    "id",
  ];
  const rows = events.map((e) =>
    [
      e.title,
      e.date,
      e.timeBand,
      e.org,
      e.postedBy,
      e.notes,
      String(e.checkedBeforePublish),
      e.id,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function parseCsv(text: string): EventRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: EventRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCsvLine(line);
    const title = cols[idx("title")] ?? "";
    const date = cols[idx("date")] ?? "";
    const timeBand = (cols[idx("timeband")] ?? "evening") as TimeBand;
    const org = cols[idx("org")] ?? "";
    if (!title || !date || !org) continue;
    const now = new Date().toISOString();
    out.push({
      id: cols[idx("id")] || uid(),
      title,
      date,
      timeBand: ["morning", "afternoon", "evening"].includes(timeBand)
        ? timeBand
        : "evening",
      org,
      postedBy: cols[idx("postedby")] ?? "",
      notes: cols[idx("notes")] ?? "",
      checkedBeforePublish: (cols[idx("checkedbeforepublish")] ?? "").toLowerCase() === "true",
      createdAt: now,
      updatedAt: now,
    });
  }
  return out;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

export function downloadText(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
