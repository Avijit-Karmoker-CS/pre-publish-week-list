export type TimeBand = "morning" | "afternoon" | "evening";

export type EventRow = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  timeBand: TimeBand;
  org: string;
  postedBy: string;
  notes: string;
  checkedBeforePublish: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StoreSnapshot = {
  version: 1;
  events: EventRow[];
  orgs: string[];
  updatedAt: string;
};

export const TIME_BANDS: { id: TimeBand; label: string; hint: string }[] = [
  { id: "morning", label: "Morning", hint: "Before noon" },
  { id: "afternoon", label: "Afternoon", hint: "Noon–5pm" },
  { id: "evening", label: "Evening", hint: "After 5pm" },
];

export const DEFAULT_ORGS = [
  "Harbour Launch Collective",
  "Peer Hub East",
  "Coastal Founders Lab",
  "Portside Accelerator",
  "Northwind Mentors",
  "Fundy Studio",
];
